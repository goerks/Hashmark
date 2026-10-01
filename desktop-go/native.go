package main

// monitor ist ein Bildschirm in den Koordinaten der jeweiligen Plattform; Index = Position in der Liste des Systems
type monitor struct {
	X, Y, W, H, Index int
	Primary           bool
}
