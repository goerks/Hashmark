# Software und Systeme

Formeln, die Architekten wirklich brauchen.

## Verfügbarkeit

$$
A = \frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}}
$$

Mit MTBF = 700 h und MTTR = 2 h ergibt sich $A = \dfrac{700}{702} \approx 99{,}7\,\%$.

## Das Gesetz von Little

::: columns cols=2
::: col
$$
L = \lambda \cdot W
$$

- $L$: Anzahl Aufträge im System
- $\lambda$: Ankunftsrate
- $W$: mittlere Verweildauer
:::
::: col
Beispiel: Bei $\lambda = 20\,\text{s}^{-1}$ und $W = 0{,}15\,\text{s}$ sind im Mittel $L = 3$ Aufträge gleichzeitig im System.
:::
:::

## Amdahl und Skalierung

$$
S(n) = \frac{1}{(1 - p) + \dfrac{p}{n}} \qquad \lim_{n\to\infty} S(n) = \frac{1}{1 - p}
$$

Sind $90\,\%$ parallelisierbar, wird es nie mehr als zehnmal schneller.

## Komplexität

| Verfahren | Aufwand |
| --- | --- |
| Suche in Hashtabelle | $\mathcal{O}(1)$ |
| Binäre Suche | $\mathcal{O}(\log n)$ |
| Sortieren (Merge Sort) | $\mathcal{O}(n \log n)$ |
| Alle Paare vergleichen | $\mathcal{O}(n^2)$ |

## Entropie und Softmax

$$
H(X) = -\sum_{i} p_i \log_2 p_i \qquad \sigma(z)_i = \frac{e^{z_i}}{\sum_{j} e^{z_j}}
$$
