# Mathematik

Von Schulstoff bis Analysis.

## Quadratische Gleichung

Lösung von $ax^2 + bx + c = 0$ Schritt für Schritt:

$$
\begin{aligned}
ax^2 + bx + c &= 0 \\
\htmlData{step=1}{x^2 + \tfrac{b}{a}x} &\htmlData{step=1}{= -\tfrac{c}{a}} \\
\htmlData{step=2}{\left(x + \tfrac{b}{2a}\right)^2} &\htmlData{step=2}{= \tfrac{b^2 - 4ac}{4a^2}} \\
\htmlData{step=3}{x_{1,2}} &\htmlData{step=3}{= \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}}
\end{aligned}
$$

## Gleichungssystem und Matrix

::: columns cols=2
::: col
Eine Funktion mit Fallunterscheidung:

$$
f(x) =
\begin{cases}
x^2 & \text{für } x \ge 0 \\
-x & \text{für } x < 0
\end{cases}
$$
:::
::: col
Drehung um den Winkel $\varphi$ als Matrix:

$$
R(\varphi) =
\begin{pmatrix}
\cos\varphi & -\sin\varphi \\
\sin\varphi & \cos\varphi
\end{pmatrix}
$$
:::
:::

## Analysis

::: cards cols=2
::: card title="Taylor-Reihe"
$$
e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!}
$$
:::
::: card title="Ableitung"
$$
f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$
:::
::: card title="Fourier"
$$
\hat{f}(\xi) = \int f(x)\, e^{-2\pi i x \xi}\,dx
$$
:::
:::

## Das Basler Problem {layout=statement}

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$
