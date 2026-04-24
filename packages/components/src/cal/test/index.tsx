/* @refresh reload */
import "./index.css";
import {
  PrimaveraCal,
  CalendarEventConstructorProps,
  EventDB,
} from "../src/index";

const root = document.getElementById("root");

function randomTitle() {
  return [
    "Provisional riders license test",
    "Cirque Du Soleil Sydney",
    "Mudgee holiday",
  ][Math.floor(Math.random() * 3)];
}

function getDuration(durations: number[]) {
  return durations[Math.floor(Math.random() * durations.length)] * 1000 * 60;
}

let currentId = 0;
const iterId = () => (currentId++).toString();

function dummyEvents(
  startDate: Date,
  durations = [15, 60, 120],
  days = 14,
  n = 100,
) {
  const zeroStartDate = new Date(startDate);
  const endDate = new Date(zeroStartDate);
  endDate.setDate(zeroStartDate.getDate() + days);
  const events: CalendarEventConstructorProps[] = [];
  const range = endDate.valueOf() - zeroStartDate.valueOf();
  for (let i = 0; i < n; i++) {
    const random = Math.random() * range;
    const r = random % 15;
    const roundedRandom = random - r + zeroStartDate.valueOf();
    const duration = getDuration(durations);
    const color = Math.random() > 0.5 ? "blue" : "yellow";
    const date = new Date(roundedRandom);
    date.setSeconds(0);
    date.setMilliseconds(0);
    events.push({
      id: iterId(),
      title: randomTitle(),
      start: date,
      end: new Date(date.valueOf() + duration),
      allDay: false,
      color,
    });
  }
  return events;
}

const oneYearAgo = new Date().getDate() - 365;

const start = new Date(new Date().setDate(oneYearAgo));
const events = dummyEvents(start, [15, 60, 120], 365 * 2, 20000);

const startHalf = new Date(new Date().setDate(oneYearAgo));
const events24hrs = dummyEvents(
  startHalf,
  [60 * 24, 60 * 24 * 2],
  365 * 2,
  100,
);

const db = new EventDB();
db.loadEvents(events);
db.loadEvents(events24hrs);
db.ready = true;
const cal = new PrimaveraCal(db);

cal.mount(domContainer);
