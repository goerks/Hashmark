package main

import (
	"os"
	"strings"
)

// autoplayFlag erlaubt WebView2, Videos ohne vorherige Eingabe im Fenster zu starten. Die Präsentation wird oft aus dem
// Presenter-Fenster gesteuert: Die Taste kommt dann nicht als Eingabe im Präsentationsfenster an, und ein Video mit Ton
// bliebe stehen.
const autoplayFlag = "--autoplay-policy=no-user-gesture-required"

// allowAutoplay ergänzt die Browser-Argumente von WebView2 (vor dem ersten Fenster aufrufen; Kindprozesse erben sie).
// Schon gesetzte Argumente, etwa für die Tests per CDP, bleiben erhalten.
func allowAutoplay() {
	const key = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"
	args := os.Getenv(key)
	if strings.Contains(args, "--autoplay-policy") {
		return
	}
	_ = os.Setenv(key, strings.TrimSpace(args+" "+autoplayFlag))
}
