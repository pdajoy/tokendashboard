package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	dataDir     string
	frontendDir string
	refreshMu   sync.Mutex
)

func init() {
	exe, _ := os.Executable()
	projectDir := filepath.Dir(filepath.Dir(exe))

	if envData := os.Getenv("DATA_DIR"); envData != "" {
		dataDir = envData
	} else {
		dataDir = filepath.Join(projectDir, "data")
	}

	if envFrontend := os.Getenv("FRONTEND_DIR"); envFrontend != "" {
		frontendDir = envFrontend
	} else {
		frontendDir = filepath.Join(projectDir, "frontend", "dist")
	}
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func serveJSON(filename string) http.HandlerFunc {
	return cors(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dataDir, filename)
		data, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to read %s: %v", filename, err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})
}

func handleExportCSV(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(dataDir, "models.json")
	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Failed to read models data", http.StatusInternalServerError)
		return
	}

	var modelsData struct {
		Entries []struct {
			Source       string  `json:"source"`
			Model        string  `json:"model"`
			Provider     string  `json:"provider"`
			Input        int64   `json:"input"`
			Output       int64   `json:"output"`
			CacheRead    int64   `json:"cacheRead"`
			CacheWrite   int64   `json:"cacheWrite"`
			Reasoning    int64   `json:"reasoning"`
			MessageCount int     `json:"messageCount"`
			Cost         float64 `json:"cost"`
		} `json:"entries"`
		TotalCost float64 `json:"totalCost"`
	}

	if err := json.Unmarshal(data, &modelsData); err != nil {
		http.Error(w, "Failed to parse models data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=tokscale-usage.csv")

	writer := csv.NewWriter(w)
	writer.Write([]string{
		"Source", "Model", "Provider", "Input Tokens", "Output Tokens",
		"Cache Read", "Cache Write", "Reasoning", "Messages", "Cost ($)",
	})

	for _, e := range modelsData.Entries {
		writer.Write([]string{
			e.Source, e.Model, e.Provider,
			fmt.Sprintf("%d", e.Input), fmt.Sprintf("%d", e.Output),
			fmt.Sprintf("%d", e.CacheRead), fmt.Sprintf("%d", e.CacheWrite),
			fmt.Sprintf("%d", e.Reasoning), fmt.Sprintf("%d", e.MessageCount),
			fmt.Sprintf("%.4f", e.Cost),
		})
	}

	writer.Flush()
}

func handleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !refreshMu.TryLock() {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Refresh already in progress",
		})
		return
	}
	defer refreshMu.Unlock()

	projectDir := filepath.Dir(dataDir)
	scriptPath := filepath.Join(projectDir, "scripts", "update-data.sh")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Script not found: %s", scriptPath),
		})
		return
	}

	cmd := exec.Command("bash", scriptPath)
	cmd.Dir = projectDir
	home, _ := os.UserHomeDir()
	cmd.Env = append(os.Environ(),
		"PATH="+os.Getenv("PATH")+":"+home+"/.bun/bin:/opt/homebrew/bin:/usr/local/bin",
	)

	log.Printf("Running refresh: %s", scriptPath)
	output, err := cmd.CombinedOutput()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if err != nil {
		log.Printf("Refresh failed: %v\nOutput: %s", err, string(output))
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Refresh failed: %v", err),
			"output":  string(output),
		})
		return
	}

	log.Printf("Refresh completed successfully")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "Data refreshed successfully",
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	files := []string{"models.json", "monthly.json", "graph.json"}
	status := make(map[string]interface{})
	allOk := true

	for _, f := range files {
		info, err := os.Stat(filepath.Join(dataDir, f))
		if err != nil {
			status[f] = map[string]interface{}{"exists": false}
			allOk = false
		} else {
			status[f] = map[string]interface{}{
				"exists":   true,
				"size":     info.Size(),
				"modified": info.ModTime().UTC().Format(time.RFC3339),
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"healthy":  allOk,
		"dataDir":  dataDir,
		"files":    status,
		"platform": runtime.GOOS + "/" + runtime.GOARCH,
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/models", serveJSON("models.json"))
	mux.HandleFunc("/api/monthly", serveJSON("monthly.json"))
	mux.HandleFunc("/api/graph", serveJSON("graph.json"))

	mux.HandleFunc("/api/meta", serveJSON("meta.json"))
	mux.HandleFunc("/api/pricing", serveJSON("pricing.json"))
	mux.HandleFunc("/api/export/csv", cors(handleExportCSV))
	mux.HandleFunc("/api/refresh", cors(handleRefresh))
	mux.HandleFunc("/api/health", handleHealth)

	if info, err := os.Stat(frontendDir); err == nil && info.IsDir() {
		fs := http.FileServer(http.Dir(frontendDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			path := filepath.Join(frontendDir, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
		log.Printf("Serving frontend from %s", frontendDir)
	} else {
		log.Printf("Frontend directory not found at %s, serving API only", frontendDir)
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html")
			fmt.Fprintf(w, `<html><body><h1>Tokscale Dashboard API</h1>
				<p>Frontend not built yet. Run <code>cd frontend && npm run build</code></p>
				<ul>
					<li><a href="/api/health">/api/health</a></li>
					<li><a href="/api/models">/api/models</a></li>
					<li><a href="/api/monthly">/api/monthly</a></li>
					<li><a href="/api/graph">/api/graph</a></li>

					<li><a href="/api/export/csv">/api/export/csv</a></li>
				</ul></body></html>`)
		})
	}

	log.Printf("Tokscale Dashboard server starting on http://localhost:%s", port)
	log.Printf("Data directory: %s", dataDir)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
