const normalizeDateValue = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toDateInputValue = (value) => normalizeDateValue(value);

export const normalizeReminderRecord = (reminder = {}) => ({
  ...reminder,
  dueDate: normalizeDateValue(reminder.dueDate),
});
