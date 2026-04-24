import { CalendarEvent, CalendarEventConstructorProps } from "./model";
import IntervalTree from "@flatten-js/interval-tree";

type Range = [number, number];

export class EventDB {
  idMap = new Map<string, CalendarEvent>();
  tree = new IntervalTree<string>();
  ready = false; // Currently manually controlled
  constructor() {}
  indexEvent(event: CalendarEvent) {
    const range: Range = [event.start.valueOf(), event.end.valueOf()];
    this.tree.insert(range, event.id);
  }
  loadEvents(sEvents: CalendarEventConstructorProps[]) {
    for (let sEvent of sEvents) {
      const event = new CalendarEvent(sEvent);
      this.indexEvent(event);
      this.idMap.set(event.id, event);
    }
  }
  getEvents(startDate: Date, endDate: Date) {
    const range: Range = [startDate.valueOf(), endDate.valueOf()];
    const ids = this.tree.search(range);
    const arr: CalendarEvent[] = [];
    ids.forEach((id) => {
      const event = this.idMap.get(id);
      if (event) arr.push(event);
    });
    return arr;
  }
}
