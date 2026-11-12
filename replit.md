# Klimaschutz – Das Rollenspiel

Eine deutschsprachige Live-Web-App für den Sozialwissenschaftsunterricht in Klasse 8. Staat, Unternehmen und Bürger treffen in vier kurzen Runden Klimaschutzentscheidungen.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — gemeinsamer API-Server
- `pnpm --filter @workspace/klimaschutz run dev` — Web-App
- `pnpm run typecheck` — TypeScript-Prüfung
- `pnpm --filter @workspace/api-spec run codegen` — API-Clients und Validierung generieren
- `pnpm --filter @workspace/db run push` — Entwicklungsschema aktualisieren
- Dienste über ihre verwalteten Workflows starten; diese setzen `PORT` und `BASE_PATH`.

## Structure

- `artifacts/klimaschutz` — React-Oberfläche für Lehrkraft und Schüler
- `artifacts/api-server/src/lib/game/catalog.ts` — Runden, Rollen, Gründe und versteckte Spielauswirkungen
- `artifacts/api-server/src/lib/game/engine.ts` — Spielregeln, Gruppenbildung, Rollenwechsel und Auswertung
- `artifacts/api-server/src/routes/game.ts` — Raumzugang und Spielaktionen
- `lib/api-spec/openapi.yaml` — verbindlicher API-Vertrag
- `lib/db/src/schema/climate-rooms.ts` — gespeicherte Spielräume

## Product constraints from the user

- Wenig Vorwissen: einfache Alltagssprache, wenig Text, große Buttons und klare Symbole, gut auf iPads bedienbar.
- Genau vier Runden: Verkehr; Kohle und Arbeitsplätze; Unternehmen und Fabriken; Heizen und Wohnen.
- Keine zusätzlichen Rollen, Quizfragen, Zufallsereignisse, Ranglisten, Avatare, Profile oder Chatfunktionen.
- Zugang für Schüler nur mit Raumcode und Name, ohne Account oder Passwort.
- Die Gruppen werden nur zu Beginn zufällig gebildet und bleiben bei weiteren Durchgängen zusammen.
- Nach der Auswertung von Runde 4 entscheidet die Lehrkraft zwischen „Spiel beenden“ und „Neue Runde mit Rollenwechsel“.
- Bei Rollenwechsel verschiedene Perspektiven möglichst fair verteilen. Barometer und Entscheidungen vollständig zurücksetzen; keine erneute Regelerklärung, sondern kurze neue Rollenanzeige und erneut Runde 1.
- Im Lehrer-Master ist „Durchgang 1“, „Durchgang 2“ usw. sichtbar.
- Keine numerischen Auswirkungen vor einer Entscheidung zeigen.
- Die Staatskasse startet bei 100. Eine leere Staatskasse beendet das Spiel nicht, weitere Ausgaben müssen aber negative Folgen haben.
- Wiederwahl hängt hauptsächlich von Bevölkerung, Wirtschaft, Arbeitsplätzen und unpopulären Maßnahmen ab.
- Auswertung zeigt Zielkonflikte statt einer pauschalen Bewertung oder der „besten Gruppe“.

## Decisions

- Das Klimaziel 2050 ist eine Vorgabe des Unterrichtsspiels und wird als Spielziel bezeichnet, nicht als Aussage über das tatsächliche deutsche Klimaschutzgesetz.
- Spielpunkte sind ein vereinfachtes Unterrichtsmodell und keine realen Wirkungsprognosen.
- Raumzustand wird serverseitig gespeichert und jede Änderung innerhalb einer gesperrten Datenbanktransaktion verarbeitet, damit gleichzeitige Reaktionen keine Daten verlieren.
- Anonyme, raumbezogene Browserzugänge reichen für diesen ausdrücklich accountfreien Unterrichtsablauf. Zugangswerte werden nur gehasht gespeichert und niemals in Spielantworten ausgegeben.
- Spielräume und Browserzugänge gelten für 24 Stunden. Nur Vornamen bzw. eindeutige kurze Unterrichtsnamen verwenden.
- Fünf Teilnehmende lassen sich nicht vollständig auf Dreier- und Vierergruppen aufteilen. In diesem Sonderfall auf eine sechste Person warten, statt eine Rolle fehlen zu lassen.

## API/code generation notes

- Nach API-Vertragsänderungen immer Codegen ausführen.
- `info.title` bleibt `Api`.
- Der generierte React-Client verwendet React Query 5 und benötigt `dom.iterable` in seiner TypeScript-Konfiguration.
- Spielinhalte aus der öffentlichen API enthalten keine versteckten Maßnahmen-Auswirkungen.
