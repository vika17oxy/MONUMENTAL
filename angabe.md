SS2026-MRE2 ILV-Robotermodellierung
MRE2 – Robotermodellierung 0_Projekt_Angabe
Administratives
In diesem Dokument findet sich die detaillierte Angabe zu dem Projekt in der Lehrveranstaltung
Robotermodellierung. Lesen Sie die Angabe bitte genau durch und halten Sie sich an die Vorgaben und
Beurteilungskriterien. Dieses Projekt wird in einer Gruppengröße von zwei Studierenden abgewickelt.
Sollte es zu einem unausgewogenen Leistungsaufwand der Gruppenmitglieder kommen, besprechen
Sie das frühzeitig mit der Lehrkraft. In diesem Fall wird jede/r Studierende der Gruppe separat
beurteilt. Im folgenden Absatz finden Sie die prozentuelle Aufteilung der einzelnen Teilabgaben. Sollte
aufgrund der Studierendenanzahl ein/e Studierende/r keiner Gruppe zugeordnet werden können, so
wird das Projekt als Einzelprojekt mit einer Ein-Personen Gruppe mit reduzierter Aufgabenstellung
durchgeführt.
Die Beurteilung teilt sich für den Erstantritt wie folgt auf:
• Zwischenpräsentation am 3.Termin (25%)
• Endpräsentation mit Live-Demonstration (25%)
• Endabgabe des Projekts in Form eines ROS-Pakets (50%)
Bitte bereiten Sie für die Zwischenpräsentation am 3.Termin eine maximal 5-minütige Präsentation
vor, welche ihren Anwendungsfall kurz skizziert. Präsentieren Sie beide Roboter gemeinsam in einer
Simulationsumgebung live (ersatzweise mit einem Backup-Video).
Bitte bereiten Sie für die Endpräsentation eine Live-Demonstration vor, welche die Simulation mit
beiden Robotern und Ihrer Anwendungsfall zeigt. Bitte bereiten Sie auch ein Backup-Video vor, falls
die Demonstration live fehlschlagen sollte. Die Präsentation beträgt maximal 15 Minuten, wobei das
Präsentationsmedium frei gewählt werden kann. Bitte Präsentieren Sie Ihre Ergebnisse und nicht ihren
Programmcode oder Probleme, welche bei der Erstellung ihres Anwendungsfalls aufgetreten sind.
Die Endabgabe besteht aus einem Zip-Ordner, welcher die ROS-Pakete ihrer Simulation und
Programmierung enthält. Dieser Teil wird nach der Präsentation bewertet, dabei wird auf die Qualität
der Programmierung und der Simulation geachtet. Bitte beachten Sie, dass ihre ROS-Pakete bei der
Endabgabe kompilieren müssen! Abgaben die nicht unter Ihrer Anleitung bzw. Dokumentation
kompilieren werden mit 0 Punkten bewertet.
Für einen positiven Abschluss der Lehrveranstaltung müssen die Endpräsentation und die Endabgabe
des Projekts für sich genommen positiv sein (>=50%). Es gilt der Standard-Notenschlüssel der FHTW
laut Satzung. Im Rahmen der Leistungsbeurteilung wurde in der Satzung der FHTW ein Notenschlüssel
definiert, der für alle Lehrveranstaltungen gilt, sofern nicht ein anderer Notenschlüssel am Beginn
einer Lehrveranstaltung bekannt gegeben wird:
• <50% Nicht genügend
• >=50% und <63% Genügend
• >=63% und <75% Befriedigend
• >=75% und <88% Gut
• >=88% Sehr gut
SS2026-MRE2 ILV-Robotermodellierung
Projektangabe
Im Zuge dieser Lehrveranstaltung, werden Sie ein industrielles Szenario ausarbeiten, in welchem zwei
Roboter einen gemeinsamen Task ausführen. Dazu müssen beide Gruppenteilnehmerinnen und
Gruppenteilnehmer eine eigene Geometrie/Kinematik, also einen Roboter erstellen. Für
Einzelgruppen ist der Anwendungsfall mit einem Roboter auszuarbeiten.
1. Erstellen des Roboters + Endeffektor
Bitte beachten Sie das folgende Minimalanforderungen gelten, nach denen die Kinematik beurteilt
wird:
• Die Kinematik ist selbst-erstellt (keine Kopie von einem real existierenden Roboter)
• Kinematik sollte eine serielle Struktur sein (andernfalls nicht vollständig möglich in URDF zu
modellieren und darzustellen)
• Der Roboter soll mindestens 3 Freiheitsgrade (maximal 7 Freiheitsgrade → Maximum mit
Standard Kinematik Löser) haben
• Es können verschiedene Formen gewählt werden (Knickarm-Roboter, Scara-Roboter, usw.)
• Die Roboter haben selbsterstellte Endeffektoren (Greifer, Werkzeug, usw.)
• Seien sie kreativ (Beide Gruppenmitglieder haben eine unterschiedliche Roboterkinematik)
• Die Kinematiken sind realitätsnahe ausgelegt (Geometrie, Gelenke, Kräfte und Momente)
Nice-to-have Anforderungen:
• Die Roboter haben einen hohen Detailgrad (z.B.: Detailgrad der Gelenke, Getriebe, etc.)
• Die Werkzeuge bieten eine reale Funktionalität (z.B.: Parallelbackengreifer mit Simulation der
beweglichen Greiferbacken)
2. Modellieren eines Anwendungsfalls für zwei Roboter
Bitte beachten sie folgende Minimalanforderungen:
• Die zwei selbst erstellten Roboter müssen (nicht zwingend gleichzeitig) miteinander
interagieren (am selben Prozess teilnehmen)
• Beispiel: Ein Roboter hält ein Werkstück während der andere das Werkstück bearbeitet
• Die Interaktion muss einen industriellen Kontextbezug haben
• Sinnvolle wirtschaftliche Nutzung der Maschinen
Nice-to-have Anforderungen:
• Die Roboter befinden sich in einer einem industriell nachempfundenen Umfeld
(Industrierobotermontage, sinnvolle anderweitige Komponenten wie Förderbänder,
Werkzeugwechsler, Schutzzaun, Sensoren- und Aktoren Integration (z.B.: Kameraanwendung),
o.Ä.)
• Einbettung einer künstlichen Intelligenz Anwendung (Als Anregung: CNN für Computer-Vision,
LLM steuert einen Roboter, etc. Sie können hier kreativ werden – Achtung kein Must-have!)
SS2026-MRE2 ILV-Robotermodellierung
3. Simulation und Human Machine Interface (HMI)
Bitte beachten Sie folgenden Hinweis: In der Lehrveranstaltung werden Methoden vermittelt, welche
nur eine Möglichkeit darstellen, die Steuerung eines Roboters, bzw. einen Roboter selbst zu
simulieren. Sie sind nicht verpflichtet diese Methoden auf ihr Projekt anzuwenden. Es allerdings
durchaus empfohlen, sich an den in der Lehrveranstaltung gezeigten Inhalten zu orientieren.
Bitte beachten Sie folgenden Minimalanforderungen:
• Beide Roboter müssen in einer Simulationsumgebung (frei wählbar: Gazebo, Isaac Sim,
MuJoCo oder Ähnliches) zu sehen sein und sich bewegen
• Das HMI muss einen Roboter ihrer Wahl am TCP linear bewegen können (Inverse Kinematik
wird benötigt)
• Das Layout des HMIs bleibt Ihnen überlassen (Minimalanforderung: Konsolenapplikation)
• Die Simulation muss mit einem Skript gestartet werden (ros2 launch + Bash-Skript, o.Ä.)
Nice-to-have Anforderungen:
• Grafische Oberfläche für HMI in einer Applikation (Dear ImGui, Tkinter, QT, oder Ähnliches)
4. Dokumentation
Bitte beachten sie folgende Minimalanforderungen:
• Der Anwendungsfall/Roboter werden beschrieben und erklärt
• Das Starten der Anwendung/Programmierung ist dokumentiert (inkl. aller verwendeten
Fremdpakete und Abhängigkeiten)
• Die Dokumentation ist ein PDF-Dokument (bitte kein *.docx, *.txt, *.tex oder *.md, wenn Sie
in Github, Latex oder Word arbeiten, erzeugen Sie bitte eine *.pdf Datei)
Nice-to-have Anforderungen:
• Methodische Code-Dokumentation für Spezialanwendungen (Kamera, spezieller Greifer, o.Ä.)
• Renderbilder der Simulation
• Read the docs, Sphinx Documentation, Markdown, Github + Docs, oder Ähnliches
SS2026-MRE2 ILV-Robotermodellierung
Bewertungskriterien (aus dem Foliensatz 0_Administratives)
• Die Zwischenpräsentation und finale Präsentation werden mit je 25 Punkten bewertet. Alle
Teile der Bewertungskriterien werden gleich gewichtet.
• Die Endabgabe des Projekts wird mit 50 Punkten bewertet. Alle Teile der Bewertungskriterien
werden gleich gewichtet.
• Präsentationen:
• Ergebnispräsentationen (keinen Programmcode, o.Ä.)
• IMRAD Struktur
• Livedemonstration (ersatzweise ein Backup Video)
• Präsentationsgestaltung und Format
• Präsentationslänge und geforderter Inhalt
• Projekt:
• Qualität der Roboter (Konstruktion realitätsnaher Kinematiken, realitätsnahe Maße,
realitätsnahe Auslegung von Kräften und Drehmomenten)
• Qualität der Werkzeuge und Werkstücke (reale Funktionalität + Simulation)
• Qualität der Umgebung (industrielles Setting, Schutzzaun, Werkstücke, Förderbänder,
Sensoren, Aktoren, etc.)
• Industrieller wirtschaftlich sinnvoller Anwendungsfall (Empfehlung: Recherche von
realen industriellen Anwendungen – seien Sie kreativ)
• Dokumentation der Anwendung und der Programme als PDF-Dokument
• Gestaltung und Programmierung des HMI (realitätsnaher Funktionsumfang, GUI)
• Programmierung (saubere nachvollziehbare Programmierung in einer
Programmiersprache ihrer Wahl)
• Startskript (einfacher Aufruf → Dokumentation)
• ROS-Pakete (Gestaltung, sinnvolles Packaging, sinnvolle Konfiguration der Roboter,
Greifer und Werkstücke, nachvollziehbare Launchfiles, nach Konvention z.B.:
robot_description package, robot_bringup package, robot_moveit package,
robot_sim package, etc.)
• Simulationsablauf