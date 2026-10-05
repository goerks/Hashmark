# Statistik

Kennzahlen, die in Berichten ständig vorkommen.

## Kennzahlen einer Stichprobe

| Kennzahl | Formel |
| --- | --- |
| Mittelwert | $\bar{x} = \dfrac{1}{n}\sum_{i=1}^{n} x_i$ |
| Varianz | $s^2 = \dfrac{1}{n-1}\sum_{i=1}^{n} (x_i - \bar{x})^2$ |
| Standardabweichung | $s = \sqrt{s^2}$ |
| Variationskoeffizient | $v = \dfrac{s}{\bar{x}}$ |

## Normalverteilung

$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}}\, \exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)
$$

Rund $68\,\%$ der Werte liegen im Bereich $\mu \pm \sigma$, $95\,\%$ bei $\mu \pm 2\sigma$.

## Satz von Bayes

$$
P(A \mid B) = \frac{P(B \mid A)\, P(A)}{P(B)}
$$

::: steps
- $P(A)$: Vorwissen, bevor wir etwas gemessen haben
- $P(B \mid A)$: wie gut passt die Messung zur Annahme
- $P(A \mid B)$: das aktualisierte Wissen
:::

## Konfidenzintervall

Für einen Mittelwert mit bekannter Streuung:

$$
\bar{x} \;\pm\; z_{1-\alpha/2} \cdot \frac{\sigma}{\sqrt{n}}
$$
