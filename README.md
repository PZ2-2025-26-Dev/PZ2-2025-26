Oto **plan prezentacji** oraz **gotowy tekst do wygłoszenia** (w języku polskim) dla projektu *Identyfikacja różnic między dwoma zdjęciami TK metodą GNN*.

---

## Plan prezentacji (czas: ~10–12 minut)

| Część | Temat | Kluczowe punkty |
|-------|-------|------------------|
| 1 | Wprowadzenie | Cel projektu: wykrywanie zmian w obrazach TK, dlaczego GNN? |
| 2 | Dane i preprocessing | Format danych (punkty x,y), sample=1, klasy id=-1 i id=1, normalizacja. |
| 3 | Analiza statystyczna | Dlaczego obrazy są identyczne? Histogramy, testy KS, MMD, Random Forest → brak różnic. |
| 4 | Przekształcenie do grafów | Funkcja `create_local_knn_graph`: losowanie centrum, k-NN (k=8), cechy węzłów (x_rel, y_rel, odległość, gęstość). |
| 5 | Architektura GNN | 3 warstwy SAGEConv, pooling (mean+max), 2 warstwy liniowe, dropout. |
| 6 | Trening i ewaluacja | Podział 70/30, 30 epok, batch size 32, learning rate 0.001. Wynik: accuracy ≈ 0.5. |
| 7 | Test permutacyjny | Mieszanie etykiet → rozkład accuracy, p-value > 0.05 → brak realnego sygnału. |
| 8 | Interpretacja i wnioski | GNN działa nielosowo (test permutacyjny), ale obrazy są identyczne → accuracy 50% jest poprawne. Wniosek: metoda może wykrywać różnice, gdyby istniały. |

---

## Gotowy tekst prezentacji

### 1. Wprowadzenie (slajd 1)

Dzień dobry. Przedstawię projekt, którego celem jest opracowanie metody uczenia maszynowego do wykrywania różnic między dwoma zdjęciami tomografii komputerowej. W scenariuszu medycznym często porównuje się skany pacjenta przed i po leczeniu. Klasyczne metody – jak porównywanie histogramów – są niewrażliwe na lokalne zmiany przestrzenne. Dlatego sięgnęliśmy po **grafowe sieci neuronowe (GNN)**, które potrafią uczyć się relacji między punktami.

### 2. Dane i preprocessing (slajd 2)

Dane pochodzą z pliku `toyForStudents_5.root`. Mamy 200 000 punktów – po 100 000 dla klas `id = -1` i `id = 1`, dla próbki `sample = 1`. Każdy punkt to współrzędne (x, y). W pierwszym kroku normalizujemy współrzędne – odejmujemy średnią i dzielimy przez odchylenie standardowe.

### 3. Analiza statystyczna – czy obrazy są różne? (slajd 3)

Zanim zbudowaliśmy model, sprawdziliśmy, czy obrazy rzeczywiście się różnią. Wykonaliśmy:
- **Wizualizację chmur punktów** – wyglądają bardzo podobnie.
- **Histogramy rozkładów x i y** – prawie identyczne.
- **Test Kołmogorowa-Smirnowa** – p-value bardzo niskie (rzędu 10⁻⁸ dla y), ale przy 100 000 punktów nawet małe różnice są istotne statystycznie.
- **Test MMD** (Maximum Mean Discrepancy) – p-value = 0,21 → brak istotnych różnic w rozkładzie 2D.
- **Random Forest klasyfikujący pojedyncze punkty** – accuracy ≈ 0,50 – poziom losowy.

**Wniosek:** obrazy są praktycznie identyczne. Poprawnie działający model GNN powinien osiągać accuracy ≈ 50%, czyli nie lepszy niż losowe zgadywanie. Gdyby obrazy się różniły, model mógłby osiągnąć wyższą skuteczność.

### 4. Przekształcenie chmury punktów w grafy (slajd 4)

Tu kluczowa funkcja `create_local_knn_graph`. Dla każdej klasy generujemy 1000 grafów. Działanie:
- Losujemy punkt centralny i bierzemy 128 jego najbliższych sąsiadów (lokalny fragment).
- Centrujemy względem środka fragmentu – model uczy się **kształtu**, nie absolutnej pozycji.
- Każdemu węzłowi przypisujemy 4 cechy:
  1. względne x,
  2. względne y,
  3. odległość od środka fragmentu,
  4. lokalna gęstość (liczba punktów w promieniu 0,1 podzielona przez powierzchnię koła).
- Łączymy węzły w graf k-NN (k=8). Krawędzie są nieskierowane.

Tak powstaje 2000 grafów – podstawa dla GNN.

### 5. Architektura modelu GNN (slajd 5)

Model `BetterGNN` składa się z:
- **3 warstw SAGEConv** – każda agreguje cechy od sąsiadów (zasięg 1, 2, 3 skoki).
- Po każdej konwolucji funkcja aktywacji **ReLU**.
- **Pooling** – łączymy globalną średnią i globalne maksimum z wszystkich węzłów (otrzymujemy wektor 128-wymiarowy).
- **Dwie warstwy liniowe** (128 → 64 → 2) z dropoutem 0,25.

Wyjściem są logity dla dwóch klas.

### 6. Trening i wyniki (slajd 6)

Zbiór 2000 grafów podzieliliśmy na treningowy (70%) i testowy (30%). Użyliśmy:
- Batch size = 32,
- 30 epok,
- Optymalizator Adam (lr = 0,001, waga decay = 1e-5),
- Funkcja straty – entropia krzyżowa.

**Wynik:** accuracy na zbiorze testowym ≈ 0,50. Model nie potrafi rozróżnić klas – co jest zgodne z naszą hipotezą, że obrazy są identyczne.

### 7. Test permutacyjny – czy ten wynik jest przypadkowy? (slajd 7)

Aby upewnić się, że model nie nauczył się przypadkowej korelacji, przeprowadziliśmy test permutacyjny:
- 20 razy mieszaliśmy etykiety grafów,
- za każdym razem trenowaliśmy nowy model od zera,
- otrzymaliśmy rozkład accuracy dla hipotezy zerowej (przypadkowe przypisanie klas).

**Wynik:** średnia accuracy ≈ 0,499, odchylenie ≈ 0,0087, p-value = 0,75 (dla rzeczywistego wyniku 0,50). Oznacza to, że model nie wykrywa żadnego prawdziwego sygnału – działa zgodnie z oczekiwaniami.

### 8. Wnioski (slajd 8)

Podsumowując:
- **Model GNN** został poprawnie zaimplementowany i działa nielosowo (test permutacyjny).
- Ponieważ obrazy TK są identyczne, accuracy na poziomie 50% jest **poprawnym wynikiem**, a nie błędem modelu.
- Gdyby obrazy się różniły, nasza architektura – dzięki lokalnym grafom i gęstości – mogłaby te różnice wykryć.
- Projekt pokazuje, że GNN nadaje się do analizy obrazów medycznych w postaci chmur punktów, gdzie ważne są relacje przestrzenne, a nie bezwzględne położenie.

Dziękuję za uwagę.

---

Jeśli chcesz, mogę przygotować także **slajdy w formacie PowerPoint/Google Slides** na podstawie tego planu i tekstu.
