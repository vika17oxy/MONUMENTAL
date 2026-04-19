' =====================================================================
' KUKA-Style 6-DOF Industrial Robot Arm — SolidWorks Macro
' ---------------------------------------------------------------------
' Baut einen parametrischen 6-Achs-Roboterarm als Multi-Body-Part
' mit vollem Feature-Tree. Alle Maße unten als Konstanten anpassbar.
'
' Verwendung:
'   1. SolidWorks oeffnen, Extras > Makro > Ausfuehren > diese Datei
'   2. Modell wird in neuem Part generiert
'   3. Feature-Tree im FeatureManager editierbar wie handgebaut
'
' Proportionen angelehnt an KUKA KR6 R900 (Reichweite ~900 mm).
' =====================================================================

Option Explicit

' ====== PARAMETER (alle in Metern, SI-Einheiten) ======
' Basis / Sockel
Const BASE_DIA As Double = 0.22
Const BASE_HEIGHT As Double = 0.12

' Achse 1 (J1) - Drehsockel
Const J1_DIA As Double = 0.2
Const J1_HEIGHT As Double = 0.15

' Schulter-Gehaeuse (J2)
Const SHOULDER_WIDTH As Double = 0.18
Const SHOULDER_DEPTH As Double = 0.2
Const SHOULDER_HEIGHT As Double = 0.22
Const SHOULDER_OFFSET_Y As Double = 0.075   ' Seitenversatz Oberarm

' Oberarm (Link 2: J2 -> J3)
Const UPPERARM_LENGTH As Double = 0.32
Const UPPERARM_DIA_NEAR As Double = 0.14    ' dicker an Schulter
Const UPPERARM_DIA_FAR As Double = 0.11     ' schlanker am Ellenbogen

' Ellenbogen-Gehaeuse (J3)
Const ELBOW_DIA As Double = 0.14
Const ELBOW_WIDTH As Double = 0.15

' Unterarm (Link 3: J3 -> J4)
Const FOREARM_LENGTH As Double = 0.28
Const FOREARM_DIA_NEAR As Double = 0.11
Const FOREARM_DIA_FAR As Double = 0.08

' Handgelenk J4 (Roll)
Const WRIST1_DIA As Double = 0.09
Const WRIST1_LENGTH As Double = 0.07

' Handgelenk J5 (Pitch)
Const WRIST2_WIDTH As Double = 0.1
Const WRIST2_HEIGHT As Double = 0.09
Const WRIST2_DEPTH As Double = 0.09

' Handgelenk J6 / Flansch
Const FLANGE_DIA As Double = 0.063
Const FLANGE_LENGTH As Double = 0.04
Const FLANGE_BOLT_CIRCLE As Double = 0.05
Const FLANGE_BOLT_DIA As Double = 0.006

' Optik
Const FILLET_RADIUS As Double = 0.008

' Farben (KUKA-orange + schwarz)
Const COLOR_ORANGE_R As Double = 0.94
Const COLOR_ORANGE_G As Double = 0.43
Const COLOR_ORANGE_B As Double = 0.1
Const COLOR_BLACK_R As Double = 0.12
Const COLOR_BLACK_G As Double = 0.12
Const COLOR_BLACK_B As Double = 0.12

' ====== GLOBALS ======
Dim swApp As SldWorks.SldWorks
Dim swModel As SldWorks.ModelDoc2
Dim swPart As SldWorks.PartDoc
Dim swFeatMgr As SldWorks.FeatureManager
Dim swSketchMgr As SldWorks.SketchManager
Dim swSelMgr As SldWorks.SelectionMgr
Dim boolstatus As Boolean

' =====================================================================
Sub main()
    Set swApp = Application.SldWorks

    ' Neues Part - mit Fallback-Kaskade
    Dim templatePath As String
    templatePath = swApp.GetUserPreferenceStringValue(swUserPreferenceStringValue_e.swDefaultTemplatePart)

    If Len(templatePath) > 0 Then
        Set swModel = swApp.NewDocument(templatePath, 0, 0, 0)
    End If

    ' Fallback 1: NewPart() nimmt interne Default-Vorlage
    If swModel Is Nothing Then
        Set swModel = swApp.NewPart()
    End If

    ' Fallback 2: direkter Pfad zur SW2025-Standardvorlage
    If swModel Is Nothing Then
        templatePath = "C:\ProgramData\SolidWorks\SOLIDWORKS 2025\templates\Teil.prtdot"
        Set swModel = swApp.NewDocument(templatePath, 0, 0, 0)
    End If

    If swModel Is Nothing Then
        MsgBox "Konnte kein Part erzeugen." & vbCrLf & _
               "Bitte manuell ein neues Part oeffnen (Strg+N > Teil), " & _
               "das offene Part-Fenster bleibt im Fokus, dann Makro erneut starten."
        Exit Sub
    End If

    Set swPart = swModel
    Set swFeatMgr = swModel.FeatureManager
    Set swSketchMgr = swModel.SketchManager
    Set swSelMgr = swModel.SelectionManager

    swModel.SetUnits swLengthUnit_e.swMETER, 0, 0, 3, True

    ' ===== BUILD SEQUENCE =====
    BuildBase
    BuildJ1Housing
    BuildShoulder
    BuildUpperArm
    BuildElbow
    BuildForearm
    BuildWrist1
    BuildWrist2
    BuildFlange
    ApplyGlobalFillets

    swModel.ShowNamedView2 "*Isometrisch", 7
    swModel.ViewZoomtofit2
    swModel.ClearSelection2 True

    MsgBox "6-DOF Roboterarm erzeugt." & vbCrLf & _
           "Feature-Tree voll editierbar. Alle Parameter oben im Makro."
End Sub

' =====================================================================
' BASE - Sockel (Zylinder mit Flansch)
' =====================================================================
Sub BuildBase()
    ' Skizze auf Top-Plane
    SelectPlane "Oben"
    swSketchMgr.InsertSketch True
    swSketchMgr.CreateCircleByRadius 0, 0, 0, BASE_DIA / 2
    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, BASE_HEIGHT, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "Base_Sockel"
End Sub

' =====================================================================
' J1 - Drehachse (Rotations-Housing auf Sockel)
' =====================================================================
Sub BuildJ1Housing()
    SelectPlane "Oben"
    swSketchMgr.InsertSketch True
    swSketchMgr.CreateCircleByRadius 0, 0, 0, J1_DIA / 2
    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, BASE_HEIGHT + J1_HEIGHT, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J1_DrehHousing"
End Sub

' =====================================================================
' SHOULDER - J2 Gehaeuse (Block seitlich versetzt)
' =====================================================================
Sub BuildShoulder()
    Dim zBase As Double
    zBase = BASE_HEIGHT + J1_HEIGHT

    SelectPlane "Oben"
    swSketchMgr.InsertSketch True

    ' Rechteck zentriert auf X, versetzt in Y
    Dim x1 As Double, x2 As Double, y1 As Double, y2 As Double
    x1 = -SHOULDER_WIDTH / 2
    x2 = SHOULDER_WIDTH / 2
    y1 = -SHOULDER_DEPTH / 2
    y2 = SHOULDER_DEPTH / 2
    swSketchMgr.CreateCornerRectangle x1, y1, 0, x2, y2, 0

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, zBase + SHOULDER_HEIGHT, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J2_SchulterHousing"
End Sub

' =====================================================================
' UPPER ARM - J2 -> J3 (konischer Link)
' =====================================================================
Sub BuildUpperArm()
    Dim zJ2 As Double
    zJ2 = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6

    ' Ebene parallel zu Front auf Y-Offset der Schulter
    Dim planeName As String
    planeName = CreateOffsetPlane("Vorne", SHOULDER_OFFSET_Y, "Ebene_Oberarm")

    ' Skizze: Zwei Kreise + Loft waere sauberer, aber wir nehmen einfachen
    ' Extrude mit Rechteck-Kontur + spaeter Draft fuer konischen Look
    SelectPlane planeName
    swSketchMgr.InsertSketch True

    ' Kreis am J2-Punkt
    swSketchMgr.CreateCircleByRadius 0, zJ2, 0, UPPERARM_DIA_NEAR / 2
    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, UPPERARM_LENGTH, 0, _
        False, False, False, False, _
        0.05, 0, _
        True, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "Link_Oberarm"
End Sub

' =====================================================================
' ELBOW - J3 Gehaeuse
' =====================================================================
Sub BuildElbow()
    Dim zElbow As Double
    zElbow = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6 + UPPERARM_LENGTH

    ' Auf Right-Plane (senkrecht zum Arm)
    Dim planeName As String
    planeName = CreateOffsetPlane("Rechts", 0, "Ebene_Ellenbogen")
    SelectPlane planeName
    swSketchMgr.InsertSketch True

    ' Kreis um Ellenbogen-Mitte
    swSketchMgr.CreateCircleByRadius SHOULDER_OFFSET_Y, zElbow, 0, ELBOW_DIA / 2

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, True, False, _
        swEndConditions_e.swEndCondBlind, swEndConditions_e.swEndCondBlind, _
        ELBOW_WIDTH / 2, ELBOW_WIDTH / 2, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J3_EllenbogenHousing"
End Sub

' =====================================================================
' FOREARM - J3 -> J4 (konischer Link horizontal/abwaerts)
' =====================================================================
Sub BuildForearm()
    Dim zElbow As Double
    zElbow = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6 + UPPERARM_LENGTH

    Dim planeName As String
    planeName = CreateOffsetPlane("Vorne", SHOULDER_OFFSET_Y, "Ebene_Unterarm")
    SelectPlane planeName
    swSketchMgr.InsertSketch True

    ' Kreis am Ellenbogen, Richtung +X (horizontal)
    swSketchMgr.CreateCircleByRadius 0, zElbow, 0, FOREARM_DIA_NEAR / 2

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(False, False, False, _
        swEndConditions_e.swEndCondBlind, 0, FOREARM_LENGTH, 0, _
        False, False, False, False, _
        0.04, 0, _
        True, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "Link_Unterarm"
End Sub

' =====================================================================
' WRIST 1 - J4 Roll
' =====================================================================
Sub BuildWrist1()
    Dim zElbow As Double
    Dim xWrist As Double
    zElbow = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6 + UPPERARM_LENGTH
    xWrist = FOREARM_LENGTH

    Dim planeName As String
    planeName = CreateOffsetPlane("Vorne", SHOULDER_OFFSET_Y, "Ebene_Wrist1")
    SelectPlane planeName
    swSketchMgr.InsertSketch True
    swSketchMgr.CreateCircleByRadius xWrist, zElbow, 0, WRIST1_DIA / 2

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, WRIST1_LENGTH, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J4_WristRoll"
End Sub

' =====================================================================
' WRIST 2 - J5 Pitch (Gabelkopf)
' =====================================================================
Sub BuildWrist2()
    Dim zElbow As Double, xWrist As Double
    zElbow = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6 + UPPERARM_LENGTH
    xWrist = FOREARM_LENGTH + WRIST1_LENGTH

    Dim planeName As String
    planeName = CreateOffsetPlane("Vorne", SHOULDER_OFFSET_Y, "Ebene_Wrist2")
    SelectPlane planeName
    swSketchMgr.InsertSketch True

    ' Block um Pitch-Achse
    swSketchMgr.CreateCornerRectangle _
        xWrist, zElbow - WRIST2_HEIGHT / 2, 0, _
        xWrist + WRIST2_WIDTH, zElbow + WRIST2_HEIGHT / 2, 0

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, True, False, _
        swEndConditions_e.swEndCondBlind, swEndConditions_e.swEndCondBlind, _
        WRIST2_DEPTH / 2, WRIST2_DEPTH / 2, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J5_WristPitch"
End Sub

' =====================================================================
' FLANGE - J6 Werkzeugflansch (ISO 9409-1-50-4-M6 aehnlich)
' =====================================================================
Sub BuildFlange()
    Dim zElbow As Double, xFlange As Double
    zElbow = BASE_HEIGHT + J1_HEIGHT + SHOULDER_HEIGHT * 0.6 + UPPERARM_LENGTH
    xFlange = FOREARM_LENGTH + WRIST1_LENGTH + WRIST2_WIDTH

    Dim planeName As String
    planeName = CreateOffsetPlane("Vorne", SHOULDER_OFFSET_Y, "Ebene_Flansch")
    SelectPlane planeName
    swSketchMgr.InsertSketch True
    swSketchMgr.CreateCircleByRadius xFlange, zElbow, 0, FLANGE_DIA / 2

    Dim f As Object
    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, FLANGE_LENGTH, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 0, False)
    RenameLastFeature "J6_Flansch"

    ' Schraubenlochkreis (4x M6 auf Bolt Circle)
    SelectPlane planeName
    swSketchMgr.InsertSketch True
    Dim i As Integer
    For i = 0 To 3
        Dim ang As Double, cx As Double, cy As Double
        ang = i * 1.5707963   ' 90 deg
        cx = xFlange + (FLANGE_BOLT_CIRCLE / 2) * Cos(ang)
        cy = zElbow + (FLANGE_BOLT_CIRCLE / 2) * Sin(ang)
        swSketchMgr.CreateCircleByRadius cx, cy, 0, FLANGE_BOLT_DIA / 2
    Next i

    Set f = swFeatMgr.FeatureExtrusion3(True, False, False, _
        swEndConditions_e.swEndCondBlind, 0, FLANGE_LENGTH + 0.001, 0, _
        False, False, False, False, 0, 0, False, False, False, False, _
        True, True, True, 0, 1, False)
    RenameLastFeature "J6_Schraubenloecher"
End Sub

' =====================================================================
' GLOBAL FILLETS - einheitliche Kantenverrundung
' =====================================================================
Sub ApplyGlobalFillets()
    ' Optional: alle scharfen Kanten mit globalem Fillet weichzeichnen
    ' Ausgelassen fuer erste Version - manuell einfacher zu kontrollieren
End Sub

' =====================================================================
' HELPERS
' =====================================================================
Sub SelectPlane(planeName As String)
    swModel.ClearSelection2 True
    boolstatus = swModel.Extension.SelectByID2(planeName, "PLANE", _
        0, 0, 0, False, 0, Nothing, 0)
End Sub

Function CreateOffsetPlane(refPlane As String, offset As Double, newName As String) As String
    swModel.ClearSelection2 True
    boolstatus = swModel.Extension.SelectByID2(refPlane, "PLANE", _
        0, 0, 0, False, 0, Nothing, 0)
    Dim refPlaneFeat As Object
    Set refPlaneFeat = swFeatMgr.InsertRefPlane( _
        swRefPlaneReferenceConstraints_e.swRefPlaneReferenceConstraint_Distance, offset, _
        0, 0, 0, 0)
    If Not refPlaneFeat Is Nothing Then
        refPlaneFeat.Name = newName
        CreateOffsetPlane = newName
    Else
        CreateOffsetPlane = refPlane
    End If
End Function

Sub RenameLastFeature(newName As String)
    Dim feat As SldWorks.Feature
    Set feat = swPart.FeatureByPositionReverse(0)
    If Not feat Is Nothing Then
        feat.Name = newName
    End If
End Sub
