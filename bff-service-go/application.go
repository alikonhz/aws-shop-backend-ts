package main

import (
	"fmt"
	"github.com/joho/godotenv"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalln("failed to load .env file: ", err)
	}

	log.Println("SERVICE_PRODUCTS_URL: ", os.Getenv("SERVICE_PRODUCTS_URL"))
	log.Println("SERVICE_CART_URL: ", os.Getenv("SERVICE_CART_URL"))

	handleFromEnv("SERVICE_PRODUCTS_URL", []string{"/products", "/products/"})
	handleFromEnv("SERVICE_CART_URL", []string{"/cart"})

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

func handleFromEnv(envKey string, paths []string) {
	targetURL, err := url.Parse(os.Getenv(envKey))
	if err != nil {
		log.Fatalf("failed to parse env key %q URL: %v\n", envKey, err)
	}

	h1 := func(path string, p *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
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
		http.HandleFunc(path, h1(path, proxy))
	}
}
