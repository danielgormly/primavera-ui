import { PrimaveraCal, EventDB } from "../src/cal";

const db = new EventDB();
const today = new Date();
today.setHours(0, 0, 0, 0);

db.loadEvents([
  {
    id: "1",
    title: "Standup",
    start: new Date(today.valueOf() + 9 * 3600_000),
    end: new Date(today.valueOf() + 9.5 * 3600_000),
    allDay: false,
    color: "blue",
  },
  {
    id: "2",
    title: "Conference",
    start: today,
    end: new Date(today.valueOf() + 2 * 86400_000),
    allDay: true,
    color: "yellow",
  },
]);
db.ready = true;

const cal = new PrimaveraCal(db);
cal.mount(document.getElementById("cal")!);
