const millisecsPerMinute = 1000 * 60;
const millisecsPerHour = millisecsPerMinute * 60;
const millisecsPerDay = millisecsPerHour * 24;

function addTimezoneOffset(date) {
    return new Date(date.getTime() + date.getTimezoneOffset()*(millisecsPerMinute))
}

const currentDateWithOffset = addTimezoneOffset(new Date());

function dateToYYYYMMDD(date) {
    const d = date.getDate();
    const m = date.getMonth() + 1; //Month from 0 to 11
    const y = date.getFullYear();
    return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
}

function dateToMMDDYYYY(date) {
    const d = date.getDate();
    const m = date.getMonth() + 1; //Month from 0 to 11
    const y = date.getFullYear();
    return '' + m + '/' + d + '/' + y
}

function dateToShortWeekday(date) {
    return (new Intl.DateTimeFormat('en-US', { weekday: "short" })).format(date)
}

function dateToTitle(date) {

    return dateToYYYYMMDD(date) + ' (' + dateToShortWeekday(date) + ')';
}

function getTimezoneFormattedDateStr(date) {
    const dateStr = date.toISOString();
    const timezoneHourOffset = date.getTimezoneOffset()/60;
    const formattedDateStr = dateStr.substring(0, dateStr.length-2) + (timezoneHourOffset > 0 ? '-':'+') + (timezoneHourOffset < 10 && timezoneHourOffset > -10 ? "0" + timezoneHourOffset.toString() : timezoneHourOffset.toString()) + ':00' ;
    return formattedDateStr;
}

export {
    currentDateWithOffset,
    addTimezoneOffset,
    millisecsPerHour,
    millisecsPerDay,
    dateToYYYYMMDD,
    dateToTitle,
    getTimezoneFormattedDateStr
}