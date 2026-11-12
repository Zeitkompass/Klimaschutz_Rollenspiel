import type { GameCatalog, Meters } from "@workspace/api-zod";

export const INITIAL_METERS: Meters = {
  climate: 0, population: 70, economy: 70, treasury: 100, reelection: 70,
};

export const catalog: GameCatalog = {
  initialMeters: INITIAL_METERS,
  climateTarget: 100,
  roles: [
    { id: "state", title: "Staat", description: "Erreiche das Klimaziel. Aber die Menschen sollen dich weiter wählen und die Staatskasse darf nicht leer werden." },
    { id: "business", title: "Unternehmen", description: "Senke den CO₂-Ausstoß. Aber dein Unternehmen muss Geld verdienen und Arbeitsplätze erhalten." },
    { id: "citizen", title: "Bürger", description: "Hilf beim Klimaschutz. Aber dein Leben muss bezahlbar bleiben und dein Arbeitsplatz soll sicher sein." },
  ],
  citizenReasons: [
    "Es wird für mich zu teuer.",
    "Mein Arbeitsplatz könnte gefährdet sein.",
    "Ich finde die Maßnahme sinnvoll.",
    "Ich fühle mich zu stark eingeschränkt.",
    "Es gibt eine gute Alternative.",
  ],
  businessReasons: [
    "Der Umbau ist zu teuer.",
    "Arbeitsplätze könnten verloren gehen.",
    "Wir bekommen genug Unterstützung.",
    "Die Maßnahme ist machbar.",
    "Wir brauchen mehr Zeit.",
  ],
  rounds: [
    {
      number: 1, title: "Verkehr",
      problem: "Autos und Flugzeuge verursachen viel CO₂. Deutschland muss den CO₂-Ausstoß im Verkehr senken.",
      measures: [
        { id: "1a", title: "Klimaschädliches Reisen wird teurer.", description: "Fliegen und Autofahren mit hohem CO₂-Ausstoß kosten mehr.", warning: "Kann Bürger verärgern." },
        { id: "1b", title: "Bus und Bahn werden günstiger und besser.", description: "Der Staat bezahlt mehr Geld für Busse und Bahnen.", warning: "Teuer für den Staat." },
        { id: "1c", title: "Kaum neue Regeln.", description: "Die Menschen entscheiden selbst, wie sie reisen.", warning: "Das Klimaziel wird schwieriger." },
      ],
    },
    {
      number: 2, title: "Kohle und Arbeitsplätze",
      problem: "Kohlekraftwerke stoßen viel CO₂ aus. Gleichzeitig arbeiten viele Menschen direkt oder indirekt in der Kohleindustrie.",
      measures: [
        { id: "2a", title: "Kohlekraftwerke schnell schließen.", description: "Die Kraftwerke werden in kurzer Zeit stillgelegt.", warning: "Arbeitsplätze können verloren gehen." },
        { id: "2b", title: "Kohlekraftwerke schließen und neue Arbeitsplätze fördern.", description: "Der Staat unterstützt neue Betriebe und Arbeitsplätze in den betroffenen Regionen.", warning: "Sehr teuer für den Staat." },
        { id: "2c", title: "Kohlekraftwerke erst später schließen.", description: "Die Kraftwerke bleiben vorerst in Betrieb.", warning: "Das Klimaziel wird schwieriger." },
      ],
    },
    {
      number: 3, title: "Unternehmen und Fabriken",
      problem: "Viele Fabriken verbrauchen viel Energie und stoßen CO₂ aus. Klimafreundliche Technik kostet aber viel Geld.",
      measures: [
        { id: "3a", title: "Unternehmen müssen schnell umbauen und selbst bezahlen.", description: "Die Fabriken investieren selbst in klimafreundliche Technik.", warning: "Kann Unternehmen und Arbeitsplätze belasten." },
        { id: "3b", title: "Der Staat bezahlt einen Teil des Umbaus.", description: "Unternehmen bekommen Geld für klimafreundliche Technik.", warning: "Sehr teuer für den Staat." },
        { id: "3c", title: "Unternehmen bekommen mehr Zeit.", description: "Die Fabriken bauen nach und nach um.", warning: "Das Klimaziel wird schwieriger." },
      ],
    },
    {
      number: 4, title: "Heizen und Wohnen",
      problem: "Viele Häuser werden noch mit Gas oder Öl beheizt. Neue klimafreundlichere Heizungen können viel Geld kosten.",
      measures: [
        { id: "4a", title: "Alte Heizungen müssen schnell ersetzt werden.", description: "Die Menschen bezahlen ihre neue Heizung selbst.", warning: "Kann für Bürger sehr teuer werden." },
        { id: "4b", title: "Der Staat hilft beim Bezahlen.", description: "Der Staat übernimmt einen Teil der Kosten neuer Heizungen.", warning: "Sehr teuer für den Staat." },
        { id: "4c", title: "Der Austausch bleibt freiwillig.", description: "Die Menschen entscheiden selbst, wann sie ihre Heizung ersetzen.", warning: "Das Klimaziel wird schwieriger." },
      ],
    },
  ],
};

type Impact = {
  delta: Omit<Meters, "reelection">;
  jobs: number;
  unpopular: number;
  explanations: string[];
};
const impact = (
  climate: number, population: number, economy: number, treasury: number,
  jobs: number, unpopular: number, explanations: string[],
): Impact => ({ delta: { climate, population, economy, treasury }, jobs, unpopular, explanations });

// Deliberately simple teaching model; these are game points, not forecasts.
// State decisions dominate; reactions can change their climate effect by ±4.
// Every A/B choice gives 34 climate points; C gives 6/0/6/6.
// With neutral reactions, three strong choices reach the target (102–108
// before clamping). Two or more C choices miss it even with full support.
export const impacts: Record<string, Impact> = {
  "1a": impact(34, -14, -3, 15, 0, 3, ["Der CO₂-Ausstoß im Verkehr sinkt deutlich.", "Höhere Reisepreise belasten die Menschen.", "Der Staat nimmt zusätzlich Geld ein."]),
  "1b": impact(34, 8, 3, -25, 0, 0, ["Mehr Menschen nutzen Bus und Bahn. Der CO₂-Ausstoß sinkt.", "Günstigere Fahrten entlasten die Menschen.", "Der Ausbau kostet den Staat viel Geld."]),
  "1c": impact(6, 6, 5, 0, 0, 0, ["Der CO₂-Ausstoß sinkt kaum.", "Für Reisende und Unternehmen bleibt vieles einfach.", "Das Klimaziel rückt kaum näher."]),
  "2a": impact(34, -20, -22, 0, 7, 3, ["Ohne Kohlekraftwerke wird viel CO₂ eingespart.", "Viele Menschen sorgen sich um ihren Arbeitsplatz.", "Arbeitsplatzverluste belasten die Wirtschaft und die Wiederwahl."]),
  "2b": impact(34, 0, -4, -40, 1, 0, ["Der Kohleausstieg spart viel CO₂ ein.", "Neue Arbeitsplätze helfen den betroffenen Menschen.", "Die Unterstützung kostet den Staat sehr viel Geld."]),
  "2c": impact(0, 5, 7, 0, 0, 0, ["Die Kohlekraftwerke stoßen weiter viel CO₂ aus.", "Die Arbeitsplätze bleiben zunächst erhalten.", "Das Klimaziel wird schwieriger."]),
  "3a": impact(34, -8, -20, 0, 5, 2, ["Die neue Technik spart viel CO₂ ein.", "Der schnelle Umbau belastet die Unternehmen.", "Einige Arbeitsplätze geraten in Gefahr."]),
  "3b": impact(34, 4, 8, -35, 0, 0, ["Klimafreundliche Fabriken sparen viel CO₂ ein.", "Die Unterstützung hilft Unternehmen und Arbeitsplätzen.", "Der Staat gibt sehr viel Geld für den Umbau aus."]),
  "3c": impact(6, 0, 6, 0, 0, 0, ["Der CO₂-Ausstoß sinkt nur langsam.", "Die Unternehmen haben mehr Zeit und weniger Kosten.", "Das Klimaziel bleibt schwer erreichbar."]),
  "4a": impact(34, -20, 4, 0, 0, 4, ["Neue Heizungen sparen viel CO₂ ein.", "Die hohen Kosten belasten viele Haushalte.", "Der Heizungsbau bekommt neue Aufträge."]),
  "4b": impact(34, 8, 4, -30, 0, 0, ["Neue Heizungen sparen viel CO₂ ein.", "Die finanzielle Hilfe entlastet die Haushalte.", "Die Förderung kostet den Staat sehr viel Geld."]),
  "4c": impact(6, 5, 0, 0, 0, 0, ["Nur wenige Heizungen werden ausgetauscht.", "Die Menschen müssen nicht sofort viel Geld ausgeben.", "Das Klimaziel wird schwieriger."]),
};
