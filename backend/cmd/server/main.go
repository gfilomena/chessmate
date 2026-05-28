package main

import (
	"bufio"
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"chess-clone/backend/internal/api"
	"chess-clone/backend/internal/db"
	"chess-clone/backend/internal/matchmaking"
)

//go:embed all:static
var staticFiles embed.FS

func main() {
	loadDotEnv(".env")

	pgURL := getEnv("DATABASE_URL", "postgres://chess:chess_secret@localhost:5433/chessdb")
	port := getEnv("PORT", "8080")

	pg, err := db.NewPostgres(pgURL)
	if err != nil {
		log.Fatalf("postgres connection failed: %v", err)
	}
	defer pg.Close()

	// Matchmaker in-memory (nessun Redis)
	mm := matchmaking.NewMatchmaker(pg)
	go mm.Run(context.Background())

	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatalf("errore fs.Sub su static: %v", err)
	}

	router := api.NewRouter(pg, mm, staticFS)

	log.Printf("Server avviato su :%s", port)
	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func loadDotEnv(filename string) {
	f, err := os.Open(filename)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
	log.Println(".env caricato")
}
