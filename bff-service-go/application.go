package main

import (
	"fmt"
	"github.com/joho/godotenv"
	cache "github.com/victorspringer/http-cache"
	"github.com/victorspringer/http-cache/adapter/memory"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalln("failed to load .env file: ", err)
	}

	memcached, err := memory.NewAdapter(
		memory.AdapterWithAlgorithm(memory.LRU),
		memory.AdapterWithCapacity(10000),
	)

	if err != nil {
		log.Fatalln("failed to initialize memory cache: ", err)
	}

	cacheClient, err := cache.NewClient(
		cache.ClientWithAdapter(memcached),
		cache.ClientWithTTL(2*time.Minute),
		cache.ClientWithRefreshKey("opn"),
	)

	if err != nil {
		log.Fatalln("failed to create new cache client: ", err)
	}

	log.Println("SERVICE_PRODUCTS_URL: ", os.Getenv("SERVICE_PRODUCTS_URL"))
	log.Println("SERVICE_CART_URL: ", os.Getenv("SERVICE_CART_URL"))

	handleFromEnv("SERVICE_PRODUCTS_URL", []string{"/products"}, cacheClient)
	handleFromEnv("SERVICE_PRODUCTS_URL", []string{"/products/"}, nil)
	handleFromEnv("SERVICE_CART_URL", []string{"/cart"}, nil)

	http.HandleFunc("/", badGateway)
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	address := fmt.Sprintf("0.0.0.0:%s", port)
	log.Println("starting on: ", address)

	err = http.ListenAndServe(address, nil)
	if err != nil {
		log.Fatalln(err)
	}
}

func badGateway(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusBadGateway)
	w.Write([]byte("Cannot process request"))
}

func handleFromEnv(envKey string, paths []string, cacheClient *cache.Client) {
	targetURL, err := url.Parse(os.Getenv(envKey))
	if err != nil {
		log.Fatalf("failed to parse env key %q URL: %v\n", envKey, err)
	}

	h1 := func(path string, p http.Handler) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {

			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "*")

			r.Host = targetURL.Host

			t := targetURL.RequestURI()
			if t != "" {
				r.RequestURI = t
			}

			log.Printf("%s -> %s %s \n", path, r.Host, r.RequestURI)

			p.ServeHTTP(w, r)
		}
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	for _, path := range paths {
		if cacheClient != nil {
			http.HandleFunc(path, wrapper(cacheClient.Middleware(h1(path, proxy))))
		} else {
			http.HandleFunc(path, h1(path, proxy))
		}
	}
}

func wrapper(h http.Handler) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	}
}
