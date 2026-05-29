export class NoDateError extends Error {
  constructor(message = 'تعذّر استخراج تاريخ التقرير من الملف') {
    super(message);
    this.name = 'NoDateError';
  }
}
