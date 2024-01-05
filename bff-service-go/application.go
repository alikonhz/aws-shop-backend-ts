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

	handleFromEnv("SERVICE_PRODUCTS_URL", []string{"/products", "/products/"})
	handleFromEnv("SERVICE_CART_URL", []string{"/cart"})

	http.HandleFunc("/", badGateway)
	err = http.ListenAndServe(fmt.Sprintf("0.0.0.0:%s", os.Getenv("PORT")), nil)
	if err != nil {
		log.Fatalln(err)
	}
	//e := echo.New()
	//e.Use(middleware.Logger())
	//
	//productsTarget := []*middleware.ProxyTarget{
	//	{
	//		URL: productsUrl,
	//	},
	//}
	//pg := e.Group("/products")
	//pg.Use(middleware.Proxy(middleware.NewRoundRobinBalancer(productsTarget)))
	//
	////e.Use(middleware.CORS())
	//
	//err = e.Start(fmt.Sprintf("0.0.0.0:%s", os.Getenv("PORT")))
	//if err != nil {
	//	log.Fatalln(err)
	//}
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
