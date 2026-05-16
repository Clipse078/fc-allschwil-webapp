import type { ExerciseDifficulty, ExerciseSport, TrainingFocus } from "@prisma/client";
export { EXERCISE_SPORT_LABELS, EXERCISE_DIFFICULTY_LABELS } from "@/lib/training/labels";

export type ExerciseTemplate = {
  id: string;
  sport: ExerciseSport;
  focus: TrainingFocus;
  difficulty: ExerciseDifficulty;
  title: string;
  description: string;
  setup: string;
  coachingPoints: string;
  variations: string;
  equipment: string;
  durationMinutes: number;
  audienceTags: string[];
};

export const EXERCISE_CATALOG: ExerciseTemplate[] = [
  // ─── FOOTBALL ──────────────────────────────────────────────────────────────

  {
    id: "fb-rondo-4v1",
    sport: "FOOTBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Rondo 4v1",
    description:
      "Klassisches Ballbesitzspiel in einem Kreis oder Quadrat. Vier Spieler halten den Ball gegen einen Verteidiger. Kernstück des technisch-taktischen Aufwärmens.",
    setup:
      "Vier Spieler stellen sich an den Ecken eines 8×8 m Quadrats auf. Ein Verteidiger startet in der Mitte. Ziel: Ballbesitz so lange wie möglich halten.",
    coachingPoints:
      "Körperhaltung vor der Ballannahme öffnen. Schnelles Spiel mit einem Kontakt anstreben. Bewegung nach dem Pass – nie stehen bleiben. Verteidiger: unter Druck setzen und Passlinien zustellen.",
    variations:
      "5v2 für mehr Erfolg bei Anfängern. 4v1 im Dreieck (6×6 m) für erhöhte Intensität. Touch-Limit: nur 1 Kontakt erlaubt für Fortgeschrittene.",
    equipment: "1 Ball, 4 Hütchen",
    durationMinutes: 10,
    audienceTags: ["Junioren", "Aktive", "Fortgeschrittene"],
  },
  {
    id: "fb-pass-triangle-depth",
    sport: "FOOTBALL",
    focus: "TECHNICAL",
    difficulty: "BEGINNER",
    title: "Passdreick mit Tiefenpass",
    description:
      "Drei Spieler im Dreieck kombinieren mit flachem Kurzpass, bevor einer den Ball in die Tiefe spielt. Grundübung für sauberes Kombinationsspiel und Laufweg nach dem Pass.",
    setup:
      "Drei Spieler formen ein Dreieck mit ca. 10 m Abstand. A passt zu B, B legt ab zu C, C spielt den Tiefenpass auf den startenden A. Position wechseln.",
    coachingPoints:
      "Ball immer mit dem richtigen Fuss annehmen (vom Verteidiger weg öffnen). Temporeiche, flache Pässe. Timing des Tiefenpasses: Mitspieler muss schon am Laufen sein. Kommunikation durch Zuruf.",
    variations:
      "Mit Abschluss: A läuft nach Tiefenpass auf Tor und schiesst. Gegner einbauen als passiven Verteidiger. Vier Spieler: Doppelpass-Variante einbauen.",
    equipment: "1 Ball, 3 Hütchen",
    durationMinutes: 12,
    audienceTags: ["Junioren", "Aktive", "Anfänger"],
  },
  {
    id: "fb-1v1-dribbling",
    sport: "FOOTBALL",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "1v1 Dribbling-Parcours",
    description:
      "Spieler dribbelt durch einen Hütchenparcours und trifft am Ende auf einen Verteidiger zum echten 1v1. Verbindet technisches Dribbling mit Wettkampfsituation.",
    setup:
      "Parcours aus 6 Hütchen im Zickzack auf 20 m. Am Ende ein 10×10 m Tor-Feld. Angreifer startet am Eingang, Verteidiger wartet am Ende des Parcours.",
    coachingPoints:
      "Ball nah am Fuss halten in engem Raum. Blick heben beim Ausgang des Parcours – Lage des Verteidigers einschätzen. Tempo wechseln: langsam im Parcours, explosiv bei Überwindung des Verteidigers. Abschluss konsequent suchen.",
    variations:
      "Ohne Parcours: direktes 1v1 aus dem Dribbling. Mit zweitem Verteidiger. Zeitbegrenzung: Dribbling + Abschluss in 8 Sekunden.",
    equipment: "6 Hütchen, 1 Ball, 1 kleines Tor",
    durationMinutes: 15,
    audienceTags: ["Junioren", "Aktive"],
  },
  {
    id: "fb-pressing-trigger",
    sport: "FOOTBALL",
    focus: "TACTICAL",
    difficulty: "ADVANCED",
    title: "Pressing-Auslöser 6v6",
    description:
      "Team trainiert koordiniertes Pressing anhand definierter Auslöser (langer Pass, schwacher Fuss, Rückenstellung). Schafft kollektives Pressingverständnis.",
    setup:
      "6v6 auf Halbfeld. Definiere 2–3 Pressing-Auslöser gemeinsam vor dem Training. Pressing-Team zieht beim Auslöser gemeinsam vor, das andere Team versucht herauszuspielen.",
    coachingPoints:
      "Pressing muss kompakt und gleichzeitig starten – kein Einzelpressing. Deckungsschatten auf Pässe in die Tiefe. Ballgewinn = sofortiger Konterkopf. Klar kommunizieren: 'Press!' als Kommando.",
    variations:
      "Ohne Auslöser: freies Pressing-Spiel. Mit Torabschluss nach Ballgewinn (20 Sekunden Zeit). Torwart einbeziehen für realitätsnahes Aufbauspiel.",
    equipment: "Hütchen für Felder, 1 Ball, 2 Tore",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "fb-cross-finish",
    sport: "FOOTBALL",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Hereingabe und Abschluss",
    description:
      "Strukturiertes Flanken und Einlaufen zum Torabschluss. Entwickelt Timing, Technik der Hereingabe sowie den Abschluss aus Bewegung.",
    setup:
      "Flankenspieler auf beiden Seiten (Höhe Grundlinie/16er-Ecke). 2 Stürmer in der Mitte. Flanke wird ausgeführt, Stürmer laufen eingebaut ein (vorderer Pfosten, hinterer Pfosten).",
    coachingPoints:
      "Flanke: Körper über den Ball, flaches Hereinspiel oder gezielter Bogen – je nach Position. Einlaufende: Laufweg von aussen nach innen, Abstand zum Pfosten kalkulieren. Abschluss: Direktabnahme bevorzugen, Fuss stabil, Körper über Ball.",
    variations:
      "Mit aktivem Verteidiger hinter dem Stürmer. Hereingabe aus dem Laufen nach Doppelpass. Torhüter einbeziehen.",
    equipment: "Bälle (mind. 5), 2 Tore, Hütchen",
    durationMinutes: 18,
    audienceTags: ["Aktive", "Junioren", "Fortgeschrittene"],
  },
  {
    id: "fb-coordination-ladder",
    sport: "FOOTBALL",
    focus: "PHYSICAL",
    difficulty: "BEGINNER",
    title: "Koordinationsleiter – 3 Varianten",
    description:
      "Klassische Koordinationsleiter mit drei aufbauenden Varianten. Ideal als aktivierendes Aufwärmen oder Abschluss des motorischen Trainings.",
    setup:
      "Koordinationsleiter flach auf Boden. 5 m Anlauf, 5 m Auslauf. Drei Stationen nebeneinander für Gruppenbetrieb.",
    coachingPoints:
      "Hochfrequenz der Schritte betonen, nicht die Grösse. Arme aktiv mitführen. Blick geradeaus, nicht auf die Leiter. Jeden Schritt bewusst setzen, nicht hetzen.",
    variations:
      "Variante 1: Einbeinig vorwärts. Variante 2: Seitlich mit Überkreuzschritt. Variante 3: Rückwärts jedes zweite Feld. Steigerung: nach Leiter direkt Sprint 15 m.",
    equipment: "1 Koordinationsleiter",
    durationMinutes: 8,
    audienceTags: ["Junioren", "Aktive", "Anfänger", "Fortgeschrittene"],
  },

  // ─── BASKETBALL ────────────────────────────────────────────────────────────

  {
    id: "bb-mikan-drill",
    sport: "BASKETBALL",
    focus: "TECHNICAL",
    difficulty: "BEGINNER",
    title: "Mikan-Drill",
    description:
      "Klassischer Korbleger-Drill beidseits des Korbs. Entwickelt weiche Hände, korrekten Footstep und Instinkt für die Zone unter dem Korb.",
    setup:
      "1 Spieler unter dem Korb. Beginnt rechts mit rechter Hand, Korbleger, springt ab, nimmt Ball noch in der Luft, direkt links mit linker Hand. Kontinuierlich.",
    coachingPoints:
      "Korbleger immer mit dem Fuss der Wurfhand beginnen (rechts schiesst = links abdrücken). Ball hoch und weich ans Brett spielen, nicht direkt in den Korb. Rhythmus ist wichtiger als Geschwindigkeit. Ellenbogen unter dem Ball.",
    variations:
      "Power-Mikan: ohne Brett, direkt in den Korb. Reverse-Mikan: von hinten ans Brett. Zeitbegrenzung: so viele Körbe wie möglich in 30 Sekunden.",
    equipment: "1 Ball, Korb",
    durationMinutes: 6,
    audienceTags: ["Junioren", "Aktive", "Anfänger"],
  },
  {
    id: "bb-3-man-weave",
    sport: "BASKETBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "3-Mann-Weave",
    description:
      "Drei Spieler passen und laufen ohne Unterbrechung von einem Ende des Felds zum anderen, enden mit Korbleger. Kernübung für Passsicherheit in Bewegung und Transitionsspiel.",
    setup:
      "Drei Spieler an der Grundlinie. Mitte hat Ball. Passt rechts oder links, läuft hinter dem Empfänger durch. Dieser passt sofort weiter, läuft durch. Bis ans andere Ende: Abschluss mit Korbleger.",
    coachingPoints:
      "Ball immer zuerst passen, dann laufen – nicht gleichzeitig. Auf die Brust passen, nicht hinter den Mitspieler. Tempo hoch halten, kein Warten. Schlussspieler kommuniziert den Abschluss.",
    variations:
      "4-Mann-Weave für grössere Gruppen. Abschluss mit Sprungwurf statt Korbleger. Rückwärts-Pass-Version für Fortgeschrittene.",
    equipment: "1 Ball, volles Feld",
    durationMinutes: 10,
    audienceTags: ["Junioren", "Aktive"],
  },
  {
    id: "bb-pick-and-roll",
    sport: "BASKETBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Pick-and-Roll Grundform 2v2",
    description:
      "Fundamentale Pick-and-Roll-Situation mit beiden Optionen: Roll zum Korb oder Pop nach aussen. Baut taktisches Grundverständnis für das wichtigste Angriffsmuster im Basketball.",
    setup:
      "2v2 im Viertelfeld. Ballführer an Elbow-Position. Blocker setzt Screen. Ballführer nutzt Screen, Blocker rollt zum Korb oder poppt nach aussen.",
    coachingPoints:
      "Screen: Fuss an Fuss des Verteidigers setzen, breite Standbasis. Ballführer: eng am Blocker vorbeiziehen – nicht drum herum. Read des Verteidigers: switchen? droppen? hedgen? Entscheidung Roll oder Pop sofort nach Screen fällen.",
    variations:
      "1v0: Blockende und Ballführer ohne Verteidiger für Timing. 3v3 mit Flügelspieler für Kick-out-Option. Passiver Verteidiger zuerst, dann aktiv.",
    equipment: "1 Ball, Halbfeld",
    durationMinutes: 15,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "bb-freethrow-routine",
    sport: "BASKETBALL",
    focus: "MENTAL",
    difficulty: "BEGINNER",
    title: "Freiwurf-Routine unter Ermüdung",
    description:
      "Spieler führen eine feste Freiwurfroutine nach einem intensiven Spielblock aus. Trainiert die mentale Stabilität und Konsistenz unter Wettkampfbedingungen.",
    setup:
      "Nach je 3 Minuten intensivem Spiel: 2 Freiwürfe an der Linie. Feste Routine einhalten (Dribblings, Atemzug, Visierung). Danach sofort zurück ins Spiel.",
    coachingPoints:
      "Routine muss vor dem Training festgelegt und immer identisch ausgeführt werden. Atmung: tief einatmen, beim Auslösen ausatmen. Balance: gleichmässig auf beiden Füssen, Knie leicht gebeugt. Blick auf vordere Kante des Korbs.",
    variations:
      "Druck erhöhen: Team muss beide Freiwürfe machen, sonst Strafaufgabe. Solo-Training: 50 Freiwürfe täglich. Video-Analyse der eigenen Routine.",
    equipment: "1 Ball, Freiwurflinie",
    durationMinutes: 5,
    audienceTags: ["Junioren", "Aktive", "Anfänger", "Fortgeschrittene"],
  },

  // ─── HANDBALL ──────────────────────────────────────────────────────────────

  {
    id: "hb-7m-series",
    sport: "HANDBALL",
    focus: "TECHNICAL",
    difficulty: "BEGINNER",
    title: "7-Meter-Serie mit Eckenwechsel",
    description:
      "Spieler werfen Serien von 7-Meter-Würfen und variieren systematisch die Zielecken. Trainiert Wurfkraft, Genauigkeit und mentale Stärke unter Drucksituation.",
    setup:
      "Spieler an der 7-Meter-Linie. Torwart im Tor. Serie: 3 Würfe Ecke links-unten, 3 Würfe Ecke rechts-oben, 3 Würfe nach eigenem Ermessen. Torwart variiert Stellung.",
    coachingPoints:
      "Standbein kontrolliert ausrichten. Wurfarm gestreckt, Handgelenk schnappen. Keine langen Anlaufbewegungen – Konzentration auf den Wurf. Blick fixieren, dann Ball folgen. Torwart: Position und Reaktion analysieren.",
    variations:
      "Zeitdruck: 5 Würfe in 20 Sekunden. Einwurf nach Fehlwurf: Spieler wiederholt sofort. Duell: Spieler vs. Spieler – wer trifft zuerst alle 4 Ecken?",
    equipment: "5 Bälle, 1 Tor, Torhüter",
    durationMinutes: 12,
    audienceTags: ["Aktive", "Junioren", "Anfänger"],
  },
  {
    id: "hb-pivot-play",
    sport: "HANDBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Kreisläufer-Ablage 3v2",
    description:
      "Rückraumspieler kombiniert mit dem Kreisläufer in der 3v2-Überzahlsituation. Entwickelt das Verständnis für das Kreisläuferspiel als taktisches Kernmittel.",
    setup:
      "Zwei Rückraumspieler, ein Kreisläufer (Position 6) gegen zwei Abwehrspieler. Rückraum passt, Kreisläufer blockt/löst sich, erhält Ablagepass, schliesst ab.",
    coachingPoints:
      "Kreisläufer: Körperkontakt zur Abwehr aktiv suchen – Fläche schaffen. Timing der Ablage: Ball erst wenn Kreisläufer frei ist, nicht zu früh. Abwehr: Kommunikation – wer nimmt Kreisläufer, wer Rückraum? Abschluss des Kreisläufers: kurze Wurfbewegung aus dem Körperkontakt.",
    variations:
      "Passiver Angreifer zuerst. Kreisläufer darf auch ablegen (Doppelpass). 4v3 mit zweitem Rückraumspieler.",
    equipment: "3 Bälle, 1 Tor, Torhüter",
    durationMinutes: 15,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "hb-fast-break",
    sport: "HANDBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Gegenstoss aus Torwartabwurf",
    description:
      "Schneller Gegenstoss aus dem Torwartabwurf nach Ballgewinn. Trainiert Transition vom Angriff zur Verteidigung und sofortigen Gegenstoss-Automatismus.",
    setup:
      "Torwart fängt Ball oder Schuss. Sofortiger Abwurf auf startenden Flügel- oder Mittelmann. Gegner versucht zurückzusprinten. Abschluss vor Rückkehr der Verteidigung.",
    coachingPoints:
      "Torwart: sofort nach Ballgewinn Blickkontakt zur eigenen Mannschaft. Startende Spieler: Laufwege klar definieren (Flügel = Tiefe, Mitte = Schnittstelle). Tempodribbling auf direktem Weg zum Tor. Abschluss: nicht zögern, sofort werfen wenn Torlinie freigespielt.",
    variations:
      "2v1 Gegenstoss: zwei Angreifer gegen einen Verteidiger. Mit festem Zeitlimit (8 Sekunden). Simulation: 6v6, nach Ballgewinn sofort Gegenstoss.",
    equipment: "3 Bälle, volles Feld, Torhüter",
    durationMinutes: 18,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "hb-jump-shot",
    sport: "HANDBALL",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Sprungwurf aus dem Rückraum",
    description:
      "Technisches Training des Sprungwurfs von der Rückraumposition mit Anlauf, Absprung und Wurfbewegung. Grundlage des Handball-Torabschlusses.",
    setup:
      "Spieler startet 10 m vor Tor. Dribbling, 3 Schritte Anlauf, Absprung auf dem letzten Schritt, Sprungwurf auf Tor. Torwart oder Stangenziele als Orientierung.",
    coachingPoints:
      "Anlauf: letzter Schritt lang und breit für stabilen Absprung. Wurfarm weit zurück, Ellenbogen auf Schulterhöhe. Schnellste Armführung beim Abwurf – nicht mit dem ganzen Körper schleudern. Landung: auf Sprungbein, nicht auf Wurfbein (Verletzungsschutz).",
    variations:
      "Nach Doppelpass: Spieler erhält Ball erst nach Anlauf. Mit Abwehrspieler (passiv → aktiv). Sprungwurf von links und rechts üben.",
    equipment: "5 Bälle, 1 Tor",
    durationMinutes: 15,
    audienceTags: ["Junioren", "Aktive"],
  },

  // ─── VOLLEYBALL ────────────────────────────────────────────────────────────

  {
    id: "vb-serve-target",
    sport: "VOLLEYBALL",
    focus: "TECHNICAL",
    difficulty: "BEGINNER",
    title: "Aufschlag auf Zielfelder",
    description:
      "Spieler servieren systematisch auf definierte Zielfelder auf der Gegenseite. Kombiniert technische Aufschlagschulung mit taktischer Ausrichtung.",
    setup:
      "Auf Gegenseite 4 Zonen mit Hütchen markieren (kurz-links, kurz-rechts, tief-links, tief-rechts). Spieler serviert von Grundlinie, Trainer gibt Zone an. 5 Serien à 6 Aufschläge.",
    coachingPoints:
      "Float-Aufschlag: Ball mit der Handinnenfläche treffen, kein Spin. Wurfhöhe konsistent halten. Körper zur Ziellinie ausrichten. Topspin-Aufschlag (Fortgeschrittene): schnappende Bewegung des Handgelenks. Keine Angst vor Fehler – konstantes Ausprobieren.",
    variations:
      "Drei Zonen definieren: kurz, mitte, tief. Druck: Teamziel – 5 Treffer in Zone hintereinander. Spieler wählt Zone selbst, Trainer bewertet Taktik.",
    equipment: "8 Bälle, Hütchen, Netz",
    durationMinutes: 15,
    audienceTags: ["Junioren", "Aktive", "Anfänger"],
  },
  {
    id: "vb-3-touch-combo",
    sport: "VOLLEYBALL",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Drei-Kontakt-Kombination",
    description:
      "Grundlegendes Drei-Kontakt-System: Annahme → Zuspiel → Angriff. Trainiert die fundamentale Spielkette und Kommunikation im Team.",
    setup:
      "3 Spieler: Annahme (hinten), Zuspiel (Mitte), Angreifer (vorne). Trainer oder Balljunge wirft ein. Annahme zur Zuspielposition, Setter spielt Zuspiel, Angreifer schliesst ab. Rotation nach je 5 Aktionen.",
    coachingPoints:
      "Annahme: Plattform bilden, Arme zusammen, Beine als Basis. Setter: frühzeitig unter den Ball, hohes Zuspiel für Angreifer. Angreifer: Anlauf 3 Schritte (rechts → links-rechts), Armschwung maximal. Kommunikation: laut melden wer nimmt den Ball.",
    variations:
      "Mit aktivem Block auf Gegenseite. Angreifer muss Zielzone treffen. Vier-Spieler-Variante mit Libero.",
    equipment: "6 Bälle, Netz, Hütchen",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Junioren"],
  },
  {
    id: "vb-block-defense",
    sport: "VOLLEYBALL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Block-Feldabwehr-Koordination",
    description:
      "Blocker und Feldabwehr arbeiten koordiniert gegen einen gesetzten Angriff. Trainiert das räumliche Verständnis zwischen Block und Feldverteidigung.",
    setup:
      "Setter + Angreifer auf einer Seite. Block (1 oder 2 Spieler) + Libero und Feldabwehr (2–3 Spieler) auf der anderen. Setter spielt Zuspiel, Angreifer schlägt, Feldabwehr baggert hoch.",
    coachingPoints:
      "Block: Hände über das Netz, Daumen nach innen, keine Lücke. Abwehr positioniert sich hinter den Block – nicht neben ihn. Libero kommuniziert: 'Block links/rechts' als Info für Feldabwehr. Bagger nach Block: hoher Ball in Feldmitte, kein schnelles Angriffsspiel.",
    variations:
      "Einzel-Block + 3 Feldabwehrspieler für mehr Bodenabdeckung. Mit wechselnden Angriffsrichtungen. Freispiel nach erfolgreicher Feldabwehr.",
    equipment: "6 Bälle, Netz",
    durationMinutes: 18,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "vb-attack-approach",
    sport: "VOLLEYBALL",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Angriffsschlag nach Zuspiel",
    description:
      "Isoliertes Training des Angriffsschlags: Anlauf, Absprung, Armführung und gezielte Platzierung. Wichtigste Einzeltechnik für Angreifer.",
    setup:
      "Setter an Position 2 oder 3. Angreifer an Position 4 (Aussenangriff). Setter spielt hohes Zuspiel, Angreifer führt 3-Schritt-Anlauf durch und schlägt. Ziel: Linie oder Cross definieren.",
    coachingPoints:
      "Anlauf-Rhythmus: langsam-schnell (links-rechts für Rechtshänder). Absprung: beide Arme nach hinten, dann explosiv nach vorne-oben. Kontakt: Ball vor dem Körper, nicht seitlich. Handgelenk beim Kontakt nach vorne drücken für Topspin.",
    variations:
      "Tipp-Angriff (Dink) üben – sanfter Fingertipp über Block. Mit passivem Block. Zielzonen auf Gegenseite markieren.",
    equipment: "8 Bälle, Netz, Hütchen",
    durationMinutes: 15,
    audienceTags: ["Aktive", "Junioren", "Fortgeschrittene"],
  },

  // ─── FUTSAL ────────────────────────────────────────────────────────────────

  {
    id: "fs-wall-pass",
    sport: "FUTSAL",
    focus: "TECHNICAL",
    difficulty: "BEGINNER",
    title: "Doppelpass an der Bande",
    description:
      "Futsal-spezifische Wandball-Übung: Spieler nutzt die Bande als Passmöglichkeit. Grundübung für das bandengestützte Kombinationsspiel.",
    setup:
      "2 Spieler nebeneinander an der Seitenlinie. A passt zur Bande, läuft an und nimmt den Rückprall an. B passt parallel zur Bande weiter. Kontinuierliche Sequenz über 20 m.",
    coachingPoints:
      "Ball immer mit der Innenseite gegen die Bande spielen – flach, nicht zu hart. Tempo anpassen: Ball kommt schneller zurück als erwartet. Körper zur nächsten Aktion öffnen. Blick abwechselnd auf Ball und Bande.",
    variations:
      "Solo: Spieler spielt allein hin-und-her zur Bande. Mit Verteidiger: Bande nur wenn Gegner den Weg blockiert. 3v2 mit Banden-Option.",
    equipment: "2 Bälle",
    durationMinutes: 10,
    audienceTags: ["Junioren", "Aktive", "Anfänger"],
  },
  {
    id: "fs-pivot-2v1",
    sport: "FUTSAL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "Pivotspiel 2v1",
    description:
      "Zwei Feldspieler kombinieren mit dem Pivot (Fixpunkt) im 2v1. Trainiert die zentrale Futsal-Spielkonstruktion mit dem Pivot als Bindeglied.",
    setup:
      "2 Angreifer + 1 Pivot gegen 1 Verteidiger. Pivot steht nahe Torlinie. Angreifer kombinieren und suchen Pivotpass oder lösen sich selbst. Abschluss innerhalb von 8 Sekunden.",
    coachingPoints:
      "Pivot: immer in Bewegung bleiben – nie statisch stehen. Rücken zum Tor: Pivot darf sich umdrehen, wenn der Raum frei ist. Angreifer: Tiefenläufe provozieren Abwehrbewegungen für den Pivotpass. Abschluss des Pivots: kurze, kraftvolle Innenseittechnik oder Hacke.",
    variations:
      "2v2: zweiter Verteidiger für Realitätsnähe. Pivot darf ständig rotieren mit Feldspielern. Abschluss per Direktabnahme ohne Ballkontrolle.",
    equipment: "3 Bälle, 1 Tor, Hütchen",
    durationMinutes: 15,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "fs-4v4-counter",
    sport: "FUTSAL",
    focus: "TACTICAL",
    difficulty: "INTERMEDIATE",
    title: "4v4 mit Konter-Auslöser",
    description:
      "Kleines Spiel mit sofortigem Konterspiel nach Ballgewinn. Trainiert schnelle Transition und Kondition in engem Raum.",
    setup:
      "4v4 auf Futsal-Spielfeld oder Halbfeld. Nach Ballgewinn: Spieler muss sofort Gegenstoss einleiten, innerhalb von 5 Sekunden abschliessen oder Tor erzielen. Kein Zögern erlaubt.",
    coachingPoints:
      "Ballgewinn: sofort Kopf heben und Tiefenraum prüfen. Konter: keine übertriebenen Dribblings, direktes Spiel. Wenn Tor nicht möglich: Ballbesitz sichern und neu aufbauen. Pressing ohne Ball: sofort zurück in Formation.",
    variations:
      "3v3 für mehr Raum pro Spieler. Mit Joker-Spieler (neutraler Spieler, immer für ballbesitzende Mannschaft). Zeitbegrenzung: 3 Minuten volle Intensität, Pause.",
    equipment: "3 Bälle, 2 Tore",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },

  // ─── TENNIS ────────────────────────────────────────────────────────────────

  {
    id: "tn-cross-dtl-rally",
    sport: "TENNIS",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Cross-Court-Rally mit Richtungswechsel",
    description:
      "Beide Spieler rallyen cross-court, bis einer das Signal zum Down-the-Line gibt. Trainiert konsistente Grundlinienschläge und reaktionsschnellen Richtungswechsel.",
    setup:
      "2 Spieler auf Grundlinie. Rally Cross-Court (Vorhand-Vorhand). Nach Signal (z.B. 3. Schlag nach Einspiel-Pass) wechselt einer down-the-line, der andere passt sich sofort an.",
    coachingPoints:
      "Cross-Court: Auftreffpunkt Ball vor dem Körper, Schläger-Face nach links (Vorhand). Beim Richtungswechsel: Körper neu ausrichten, nicht nur den Arm schwingen. Rally-Rhythmus: locker und konsistent, keine Gewinnerschläge im Training anstreben. Kontrolle vor Power.",
    variations:
      "Cross-Rückhand: beide Spieler spielen ausschliesslich Rückhand. Richtungswechsel nur mit Slice. Spieler darf selbst entscheiden wann er wechselt.",
    equipment: "10 Bälle, Netz, 2 Schläger",
    durationMinutes: 15,
    audienceTags: ["Aktive", "Junioren", "Fortgeschrittene"],
  },
  {
    id: "tn-serve-return",
    sport: "TENNIS",
    focus: "TECHNICAL",
    difficulty: "INTERMEDIATE",
    title: "Aufschlag-Return-Training",
    description:
      "Strukturiertes Aufschlag- und Return-Training in Tandems. Trainiert Aufschlag-Konsistenz und Return-Positionierung gleichzeitig.",
    setup:
      "Spieler A serviert Serien von 10 Aufschlägen (abwechselnd Deuce/Advantage). Spieler B nimmt Return. Rotation nach jeder Serie. Ziel: Aufschlag in definierte Box, Return tief ins Feld.",
    coachingPoints:
      "Aufschlag: Abwurfpunkt konsistent (vor dem Körper, leicht rechts für Rechtshänder). Toss-Höhe: auf Schläger beim gestreckten Arm ausrichten. Return: früh starten (Split-Step bei Aufschlagbewegung), kompakte Rückhand/Vorhand. Return-Ziel: Grundlinie, nicht kurz.",
    variations:
      "Nur T-Aufschlag (Mitte). Slice-Return als einzige Returnoption. Aufschlag + 1: Spieler A schlägt auf, läuft ans Netz, Spieler B returnt und spielt Passing.",
    equipment: "20 Bälle, Netz, 2 Schläger",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Junioren"],
  },
  {
    id: "tn-approach-volley",
    sport: "TENNIS",
    focus: "TACTICAL",
    difficulty: "ADVANCED",
    title: "Approach-Shot und Netz-Abschluss",
    description:
      "Spieler schlägt kurzen Ball aus dem Mittelfeld als Approach-Shot und schliesst an der Netzkante ab. Trainiert Spielkonstruktion zum Netz und Volley-Technik.",
    setup:
      "Trainer oder Ballmaschine spielt kurzen Ball aus der Mitte ins Feld. Spieler bewegt sich vor, schlägt Approach-Shot (tief, Richtung Cross oder DTL), rückt ans Netz vor und schliesst den nächsten Ball als Volley ab.",
    coachingPoints:
      "Approach-Shot: tief spielen, nicht auf Gewinner – Druck aufbauen. Beim Vorgehen: kleiner Split-Step vor Gegners Schlag. Volley: kurze Bewegung, Schläger stillhalten, Gewicht auf Vorderfuss. Kein Ausschwingen beim Volley.",
    variations:
      "Approach + Smash: Trainer spielt Lob, Spieler schlägt Smash. 2v1: Spieler am Netz, zwei Gegner spielen Pässe und Lobs abwechselnd. Kompletter Punkt nach Approach.",
    equipment: "20 Bälle, Netz, Schläger",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },

  // ─── FITNESS / ATHLETICS ───────────────────────────────────────────────────

  {
    id: "fit-interval-sprints",
    sport: "FITNESS",
    focus: "PHYSICAL",
    difficulty: "INTERMEDIATE",
    title: "Intervall-Sprints 8×100 m",
    description:
      "Klassisches anaerobes Intervalltraining mit 8 Sprints über 100 m. Entwickelt Schnelligkeitsausdauer und mentale Stärke.",
    setup:
      "Laufstrecke 100 m markieren. Sprint bei 90–95 % der Maximalleistung. Pause: 90 Sekunden aktivs Gehen zurück. 8 Durchgänge. Vor dem Training: 15 min Einlaufen.",
    coachingPoints:
      "Tempo konstant halten – nicht die ersten 3 Sprints zu schnell angehen. Laufstil: aufrechter Oberkörper, hohe Knieführung, aktiver Armeinsatz. Atmung: rhythmisch, nicht anhalten. Auf Körpersignale hören: starke Muskelschmerzen = Pause.",
    variations:
      "4×200 m für Ausdauerbetonung. Pyramide: 50-100-150-200-150-100-50 m. Bergauf-Variante für Kraftausdauer.",
    equipment: "Stoppuhr, Hütchen, Laufbahn",
    durationMinutes: 30,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "fit-core-circuit",
    sport: "FITNESS",
    focus: "PHYSICAL",
    difficulty: "BEGINNER",
    title: "Core-Stabilisations-Circuit",
    description:
      "Zirkeltraining mit 4 Core-Grundübungen: Plank, Seitstütz, Hollow Hold, Dead Bug. Entwickelt Rumpfstabilität und Verletzungsprävention.",
    setup:
      "4 Stationen. Je 40 Sekunden Arbeit, 20 Sekunden Übergang. 3 Runden. Plank vorne → Seitstütz links → Seitstütz rechts → Hollow Hold oder Dead Bug.",
    coachingPoints:
      "Plank: gerade Linie von Kopf bis Ferse, kein Hohlkreuz. Seitstütz: Hüfte hochhalten, Körper in einer Linie. Hollow Hold: unterer Rücken am Boden gepresst, Beine gestreckt halten. Dead Bug: langsam und kontrolliert – Qualität über Geschwindigkeit.",
    variations:
      "Plank mit Arm-/Beinabheben für mehr Instabilität. Auf Balance-Pad für erhöhte Propriozeption. Zeiten steigern: von 30/30 zu 45/15 Sekunden.",
    equipment: "Gymnastikmatte",
    durationMinutes: 20,
    audienceTags: ["Aktive", "Junioren", "Anfänger", "Fortgeschrittene"],
  },
  {
    id: "fit-plyometric-circuit",
    sport: "FITNESS",
    focus: "PHYSICAL",
    difficulty: "ADVANCED",
    title: "Plyometrischer Sprungkraft-Circuit",
    description:
      "Drei Sprungkraft-Stationen: Box-Jumps, Bounding, Depth-Jumps. Entwickelt explosive Beinkraft und neuromuskuläre Koordination.",
    setup:
      "3 Stationen mit je 20 m Abstand. Station 1: Box-Jump 40–60 cm Höhe (8 Wiederholungen). Station 2: Bounding 30 m. Station 3: Depth-Jump von 40 cm Kiste (6 Wiederholungen). 2 Minuten Pause zwischen Runden. 3 Runden.",
    coachingPoints:
      "Box-Jump: weiches Landen auf Vorderfuss, sofort wieder abspringen. Bounding: maximaler Schritt und Auftrieb – nicht rennen, springen! Depth-Jump: nach Landung sofortiger reaktiver Absprung (Kontaktzeit < 0.2 s). Aufwärmen zwingend: 10 Minuten Aktivierung plus leichte Sprünge.",
    variations:
      "Anfänger: Squat-Jumps statt Depth-Jumps. Lateral-Bounds für seitliche Stabilität. Mit sportartspezifischem Abschluss nach Station 3.",
    equipment: "Sprungbox, Hütchen, Markierungen",
    durationMinutes: 35,
    audienceTags: ["Aktive", "Fortgeschrittene"],
  },
  {
    id: "fit-progressive-tempo",
    sport: "FITNESS",
    focus: "PHYSICAL",
    difficulty: "BEGINNER",
    title: "Tempolauf-Steigerung 4×400 m",
    description:
      "Vier 400-m-Läufe mit progressivem Tempo: 60 % → 70 % → 80 % → 90 %. Entwickelt Tempogefühl, aerobe Kapazität und aerob-anaerobe Umschaltfähigkeit.",
    setup:
      "400-m-Runde. Lauf 1 bei 60 % Maximalleistung (lockeres Joggen). Pause 2 Minuten. Lauf 2 bei 70 %. Pause 2 Minuten. Lauf 3 bei 80 %. Pause 2 Minuten. Lauf 4 bei 90 %. Cool-down: 10 min lockeres Auslaufen.",
    coachingPoints:
      "Zeiten für jeden Lauf notieren – Steigerung soll messbar sein. Laufstil: auch beim langsamen Lauf technisch korrekt laufen. Atmung: nasal beim lockeren Laufen, oral bei Intensität. Körpersignale respektieren: kein 4. Lauf wenn schlechte Vorbereitung.",
    variations:
      "200-m-Variante: 6×200 m für Schnelligkeitsausdauer. Auf Bergstrecke für Kraftausdauer. Mit Herzfrequenzmessung für Intensitätskontrolle.",
    equipment: "Stoppuhr, Hütchen",
    durationMinutes: 25,
    audienceTags: ["Aktive", "Anfänger", "Junioren"],
  },
];

export function getCatalogBySport(): Map<ExerciseSport, ExerciseTemplate[]> {
  const map = new Map<ExerciseSport, ExerciseTemplate[]>();
  for (const ex of EXERCISE_CATALOG) {
    const existing = map.get(ex.sport) ?? [];
    existing.push(ex);
    map.set(ex.sport, existing);
  }
  return map;
}

export function getExerciseTemplateById(id: string): ExerciseTemplate | undefined {
  return EXERCISE_CATALOG.find((e) => e.id === id);
}
