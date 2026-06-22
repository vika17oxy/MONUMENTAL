# VIKA – Spickzettel für die Prüfung

Was ist VIKA? Ein Roboter-System, das eine Mauer baut.
Zwei Roboter fahren auf einer gemeinsamen Schiene:
- **VIKA-6 (robot_a)** = hat den **Greifer**, holt Ziegel und legt sie auf.
- **VIKA-5 (robot_b)** = hat die **Zementdüse**, trägt nach jedem Kurs Mörtel auf.

Software: ROS 2 (Steuerung) · MoveIt (Bewegungsplanung) · Gazebo (Simulation) · Behavior Tree (Ablauf-Logik) · Web-HMI (Bedienoberfläche).

---

## 1. Inverse Kinematik (IK)

**Was ist das?** Aus "wo soll die Hand hin" rechnet die IK aus, welchen Winkel jedes Gelenk braucht.

- Wir benutzen den **KDL-Solver** (rechnet die Winkel Schritt für Schritt numerisch aus).
- **Warum KDL?** Der Arm hat 6 Gelenke und keine "überflüssigen" Freiheiten. Da reicht der einfache Standard-Solver – TRAC-IK & Co. wären unnötig kompliziert.
- Numerische Solver brauchen einen **Startwert (Seed)**, sonst springt die Lösung. Deshalb geben wir einen festen, bewährten Startwert vor.
- **Gerade Bewegungen (Ablegen):** Statt frei zu planen, lassen wir die Hand auf einer **geraden Linie** fahren (cartesian path). Der Roboter geht **erst über den Zielpunkt, dann gerade nach unten**. (Seitlich reinschwenken hat an den Nachbarsteinen verhakt.)
- **Warum Home-Winkel 1.55 statt 1.5708 (π/2)?** Genau auf dem Maximalwert meckert MoveIt ("Start state out of bounds"). Knapp darunter ist sicher.

## 2. Wie werden die Ziegel "gegriffen"?

**Trick in der Simulation:** Es gibt **keine echte Saugkraft**. Stattdessen wird der Ziegel per Gazebo-Funktion **fest mit dem Greifer verbunden** (DetachableJoint = verbindbares Gelenk). Aufnehmen = verbinden, Ablegen = trennen.

- Ausgelöst über ROS-Nachrichten an `/suction/<ziegel>/attach` bzw. `/detach`.
- Damit der Planer den Ziegel "mitdenkt", wird er als angehängtes Objekt am Greifer eingetragen (sonst würde er ihn als Hindernis sehen).
- **Warum so?** Echte Saug-Physik zu simulieren ist aufwendig und stürzt leicht ab. Das An-/Abkoppeln ist einfach und zuverlässig.

## 3. Aufbau des Roboters (URDF)

Ein Roboter hat **7 bewegliche Teile**: 1 Schiene zum Fahren + 6 Armgelenke.
- Die **Schiene** ist ein Schiebegelenk (fährt seitlich, bis 3 m/s).
- Der **Arm** hat 6 Drehgelenke (Basis-Drehung, Schulter, Ellbogen, drei Handgelenke).
- Beschrieben in Bausteinen (xacro-Dateien), die zu einem Gesamtroboter zusammengesetzt werden.
- VIKA-5 steht um 180° gedreht (`yaw = π`) auf derselben Schiene.
- **Besonderheit Zement-Roboter:** Die IK zielt nicht auf die Düsenspitze, sondern auf die **Handgelenk-Wurzel**, und die Düse (ca. 31 cm tiefer) wird im Ziel einberechnet. Sonst hätte der Arm ein Gelenk zu viel und würde zittern.

## 4. Ablauf-Logik (Behavior Tree)

**Was ist ein Behavior Tree?** Ein Baum aus Schritten, der den Bauablauf steuert (jeder Schritt meldet: läuft / fertig / fehlgeschlagen). Der aktuelle Stand wird ans HMI gemeldet, damit man ihn sehen kann.

**Ablauf:** VIKA-5 wegparken → Palette scannen → Ziegel erkennen → dann **für jeden Kurs und jedes Segment**:
zur Palette fahren → Ziegel anfahren → ansaugen → hochheben → zum Mauer-Segment fahren → über dem Ziel positionieren → gerade absetzen → neuen Ziegel auf der Palette nachladen → wieder hochfahren.
**Nach jedem Kurs** kommt VIKA-5 und trägt Zement auf. (3 Kurse × 3 Segmente.)

## 5. HMI-Bridge

Die "Übersetzerin" zwischen Bedienoberfläche und Roboter: Sie nimmt einfache Befehle vom HMI entgegen und macht daraus echte Roboterbewegungen.
Befehle z.B.: HOME (Grundstellung), STOP, einzelne Gelenke bewegen, Schiene fahren, ansaugen, zu Punkt X/Y/Z fahren.

## 6. Simulation (Gazebo)

- Baustellen-Welt mit den zwei Robotern.
- Auf der Palette liegt **eine "echte" (bewegliche) Reihe Ziegel**, der Rest ist nur Deko. Diese eine Reihe wird nach jedem Aufnehmen wieder an ihren Platz zurückgesetzt → es gibt immer Nachschub am selben Ort.
- **Wichtig:** Erst die Palettenreihe zurücksetzen, **dann** den abgelegten Mauer-Ziegel einfügen. Wenn sich zwei Ziegel überlappen, "explodiert" die Physik.

## 7. Sprachsteuerung

1. **Mikrofon** nimmt deutsche Sprache auf (Browser-Spracherkennung).
2. **Gemma** (lokales KI-Sprachmodell) wandelt den Satz in einen klaren Befehl um, z.B. `{robot: VIKA-6, action: HOME}`. Notfalls greift eine einfache Stichwort-Erkennung.
3. **Kokoro** spricht die Antwort vor (englische Stimme).

Beispiel: "Vika sechs Home" → VIKA-6 fährt in Grundstellung, Antwort kommt als Sprachausgabe.

## 8. Bewegungsplanung (MoveIt / OMPL)

- Für freie Bewegungen plant **OMPL** mit dem Algorithmus **RRTConnect** (sucht zufällig einen kollisionsfreien Weg).
- Geprüft wird gegen die Umgebung (Palette, Mauer, Boden).
- **Selbstkollision ist abgeschaltet**, weil das vereinfachte Roboter-Modell sich in normalen Stellungen sonst fälschlich "selbst berührt".

---

## Wie starte ich alles?

Aufbau: Gazebo + ROS laufen direkt auf dem Rechner (für die Grafik/GPU), Oberfläche und Hilfsdienste laufen in Docker. Alle reden über dasselbe ROS-Netz.

```bash
# Empfohlen (zuverlässig):
./restart-clean.sh           # sauberer Neustart, Roboter wartet
./restart-clean.sh build     # ... und startet gleich den Mauerbau

# Einfache Variante:
./start.sh
```

- Oberfläche: `http://localhost:5173`
- **Warum lieber `restart-clean.sh`?** Beim normalen Start gehen manchmal die Motor-Regler nicht an (dann bewegt sich nichts) oder es bleiben "Geister"-Prozesse übrig. `restart-clean.sh` räumt zuerst alles weg, startet neu und wartet, bis die Regler wirklich laufen – notfalls mehrmals.

```bash
# Mauerbau von Hand auslösen:
ros2 topic pub --once /hmi/mission std_msgs/msg/String '{data: BUILD}'
```

---

## Kurz & knapp: typische "Warum?"-Fragen

| Frage | Kurze Antwort |
|---|---|
| Warum KDL-Solver? | Einfacher 6-Gelenk-Arm, mehr braucht's nicht. |
| Warum Home-Winkel 1.55? | Genau am Limit meckert MoveIt; knapp darunter ist sicher. |
| Warum von oben absetzen? | Seitlich verhakt der Ziegel an den Nachbarn. |
| Warum kein echtes Saugen? | Echte Saug-Physik ist aufwendig & stürzt ab. |
| Warum zielt Zement-IK aufs Handgelenk? | Sonst ein Gelenk zu viel → Arm zittert. |
| Warum Reihe erst zurücksetzen, dann Ziegel spawnen? | Überlappung lässt die Physik "explodieren". |
| Warum nur eine echte Ziegelreihe? | Rest ist Deko; so gibt's immer Nachschub am selben Platz. |
| Warum Selbstkollision aus? | Das grobe Modell "berührt sich" sonst fälschlich selbst. |
