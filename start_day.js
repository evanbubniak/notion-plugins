
import { getEntriesForDate, createEntryForDate, completeTasks, setSleepTime, doesEntryHaveSleep } from './notion_api.js'
import { currentDateWithOffset, addTimezoneOffset, millisecsPerDay, millisecsPerHour } from './date_format.js';
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
const yargs = _yargs(hideBin(process.argv));

// fs = require("fs");
const argv = yargs
    .option('date', {
        alias: 'd',
        demandOption: false,
        describe: 'Date for configuration',
        type: 'string',
        default: '',
    })
    .option('sleep', {
        alias: 's',
        demandOption: false,
        describe: 'sleep time',
        type: 'string',
        default: ''
    })
    .option('wake', {
        alias: 'w',
        demandOption: false,
        describe: 'wake time',
        type: 'string',
        default: '',
    })
    .option('tasksdone', {
        alias: 't',
        demandOption: false,
        describe: 'tasks done',
        type: 'array',
        default: [],
    })
    .argv

async function getTime(prompt) {
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => readline.question(prompt, time => {
        resolve(time);
        readline.close();
    }))
}

async function populateEntryWithSleep(bedtimeString, waketimeString, currDate, entryId) {
    let wakeDate = new Date(currDate.getTime());
    let bedtime;
    let bedtimeWasYesterday;
    let waketime;
    bedtime = bedtimeString.substring(0, 4);
    bedtimeWasYesterday = (bedtimeString.charAt(bedtimeString.length - 1) == "y");
    waketime = waketimeString.substring(0, 4);
    let sleepDate = bedtimeWasYesterday ? new Date(wakeDate.getTime() - millisecsPerDay) : new Date(wakeDate.getTime());
    sleepDate.setHours(parseInt(bedtime.substring(0, 2)), parseInt(bedtime.substring(2, 4)), 0, 0)
    wakeDate.setHours(parseInt(waketime.substring(0, 2)), parseInt(waketime.substring(2, 4)), 0, 0)
    sleepDate = new Date(sleepDate.getTime() - millisecsPerHour * sleepDate.getTimezoneOffset() / 60);
    wakeDate = new Date(wakeDate.getTime() - millisecsPerHour * wakeDate.getTimezoneOffset() / 60);
    await setSleepTime(sleepDate, wakeDate, entryId);
}



const currDate = (argv.date === '') ? new Date(currentDateWithOffset) : addTimezoneOffset(new Date(argv.date));
const dayEntries = await getEntriesForDate(currDate);
const dayEntry = (dayEntries.length != 0) ? dayEntries[0] : await createEntryForDate(currDate);

if (argv.s !== '') {
    populateEntryWithSleep(argv.sleep, argv.wake, currDate, dayEntry.id)
} else {
    if (!await doesEntryHaveSleep(dayEntry.id)) {
        const bedtimeString = await getTime('When did you go to bed? (format: HHMM, 24-hour time, append y to end if it was yesterday)');
        const waketimeString = await getTime('when did you wake up?');
        populateEntryWithSleep(bedtimeString, waketimeString, dayEntry.id);
    }
}

if (argv.tasksdone.length > 0) {
    completeTasks(argv.tasksdone, dayEntry.id);
}

// if (await didWeightsYesterday()) {
//     console.log("no need to do weights today");
// } else {
//     console.log("do weights today")
// }


