
import {updateDayStrategy, getEntriesForDate, createEntryForDate, completeTasks, setSleepTime, doesEntryHaveSleep, updateLifeWikiDayStrategy } from './notion_api.js'
import { currentDateWithOffset, addTimezoneOffset, millisecsPerDay, millisecsPerHour } from './date_format.js';
import { createInterface } from 'readline';
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
const yargs = _yargs(hideBin(process.argv));

const argv = yargs
    .option('date', {
        alias: 'd',
        demandOption: false,
        describe: 'Date for configuration (YYYY-MM-DD format)',
        type: 'string',
        default: '',
    })
    .option('sleep', {
        alias: ['s', 'b', 'bed'],
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
    // .option('plan', {
    //     alias: 'p',
    //     demandOption: false,
    //     describe: "Strategy for the day",
    //     type: "string",
    //     default: "",
    // })
    .option('plan', {
        alias: 'p',
        demandOption: false,
        describe: "Set strategy for the day",
        type: "boolean",
        default: false
    })
    .argv

async function getUserInput(prompt) {
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => readline.question(prompt, userInput => {
        resolve(userInput);
        readline.close();
    }))
}

async function populateEntryWithSleep(bedtimeString, waketimeString, currDate, entryId) {
    let wakeDate = new Date(currDate.getTime());
    let bedtime;
    let bedtimeWasYesterday;
    let waketime;
    bedtime = bedtimeString.substring(0, 4);
    waketime = waketimeString.substring(0, 4);
    bedtimeWasYesterday = (parseInt(bedtimeString) > parseInt(waketimeString));
    let sleepDate = bedtimeWasYesterday ? new Date(wakeDate.getTime() - millisecsPerDay) : new Date(wakeDate.getTime());
    sleepDate.setHours(parseInt(bedtime.substring(0, 2)), parseInt(bedtime.substring(2, 4)), 0, 0)
    wakeDate.setHours(parseInt(waketime.substring(0, 2)), parseInt(waketime.substring(2, 4)), 0, 0)
    sleepDate = new Date(sleepDate.getTime() - millisecsPerHour * sleepDate.getTimezoneOffset() / 60);
    wakeDate = new Date(wakeDate.getTime() - millisecsPerHour * wakeDate.getTimezoneOffset() / 60);
    await setSleepTime(sleepDate, wakeDate, entryId);
}



// const currDate = (argv.date === '') ? new Date(currentDateWithOffset) : addTimezoneOffset(new Date(argv.date));

const currDate = (argv.date === '') ? new Date() : addTimezoneOffset(new Date(argv.date));
const dayEntries = await getEntriesForDate(currDate);
const dayEntry = (dayEntries.length != 0) ? dayEntries[0] : await createEntryForDate(currDate);

if (argv.sleep !== '') {
    populateEntryWithSleep(argv.sleep, argv.wake, currDate, dayEntry.id)
} else {
    if (!await doesEntryHaveSleep(dayEntry.id)) {
        const bedtimeString = await getUserInput('When did you go to bed? (format: HHMM, 24-hour time, append y to end if it was yesterday)');
        const waketimeString = await getUserInput('when did you wake up?');
        populateEntryWithSleep(bedtimeString, waketimeString, dayEntry.id);
    }
}

if (argv.plan) {
    const plan = await getUserInput("What is your plan for the day?\n")
    updateLifeWikiDayStrategy(plan);
    updateDayStrategy(dayEntry.id, plan);
}

if (argv.tasksdone.length > 0) {
    completeTasks(argv.tasksdone, dayEntry.id);
}
