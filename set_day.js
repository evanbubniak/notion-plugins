
import { retrieveLifeWikiDayStrategy, doesEntryHaveSleep, updateProps, appendChildBlocks, updateDayStrategy, getEntriesForDate, createEntryForDate, updateLifeWikiDayStrategy, getChildBlocks } from './notion_api.js'
import { addTimezoneOffset, millisecsPerDay, millisecsPerHour, getTimezoneFormattedDateStr } from './date_format.js';
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
    .option('routine', {
        alias: 'r',
        demandOption: false,
        describe: 'Mark a routine as completed for the day',
        type: 'array',
        default: [],
    })
    .option('unset-routine', {
        demandOption: false,
        describe: 'Mark a routine as not completed for the day',
        type: 'array',
        default: [],
    })
    .option('plan', {
        alias: 'p',
        demandOption: false,
        describe: "Set strategy for the day",
        type: "boolean",
        default: false
    })
    .option('tasks', {
        alias: 't',
        demandOption: false,
        describe: "Mark a task as worked on for the day (format: `task,time`)",
        type: "array",
        default: [],
    })
    .option('syncstrats', {
        demandOption: false,
        describe: "Set the day strategy to the value of the lifewiki day strategy",
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

function makeSleepProps(bedtimeString, waketimeString, currDate) {
    const bedtime = bedtimeString.padStart(4, "0").substring(0, 4);
    const waketime = waketimeString.padStart(4, "0").substring(0, 4);
    const bedtimeWasYesterday = (parseInt(bedtimeString) > parseInt(waketimeString));
    let wakeDate = new Date(currDate.getTime());
    let sleepDate = bedtimeWasYesterday ? new Date(wakeDate.getTime() - millisecsPerDay) : new Date(wakeDate.getTime());
    sleepDate.setHours(parseInt(bedtime.substring(0, 2)), parseInt(bedtime.substring(2, 4)), 0, 0)
    wakeDate.setHours(parseInt(waketime.substring(0, 2)), parseInt(waketime.substring(2, 4)), 0, 0)
    sleepDate = new Date(sleepDate.getTime() - millisecsPerHour * sleepDate.getTimezoneOffset() / 60);
    wakeDate = new Date(wakeDate.getTime() - millisecsPerHour * wakeDate.getTimezoneOffset() / 60);
    return {
        "Time in Bed": {
            "date": {
                "start": getTimezoneFormattedDateStr(sleepDate),
                "end": getTimezoneFormattedDateStr(wakeDate),
            }
        }
    };
}

function makeRoutineProps(routines, value) {
    return routines.reduce((obj, routine) => ({ ...obj, [routine]: { checkbox: value } }), {});
}

const currDate = (argv.date === '') ? new Date() : addTimezoneOffset(new Date(argv.date));
let propUpdates = {};
if (argv.sleep !== '') {
    propUpdates = { ...propUpdates, ...makeSleepProps(argv.sleep, argv.wake, currDate) };
}
if (argv.routine.length > 0) {
    propUpdates = { ...propUpdates, ...makeRoutineProps(argv.routine, true) };
}
if (argv["unset-routine"].length > 0) {
    propUpdates = { ...propUpdates, ...makeRoutineProps(argv["unset-routine"], false) };
}

const dayEntries = await getEntriesForDate(currDate);
let dayEntry;
if (dayEntries.length !== 0) {
    dayEntry = dayEntries[0];
    if (!doesEntryHaveSleep(dayEntry)) {
        const bedtimeString = await getUserInput('When did you go to bed? (format: HHMM, 24-hour time)');
        const waketimeString = await getUserInput('when did you wake up?');
        propUpdates = { ...propUpdates, ...makeSleepProps(bedtimeString, waketimeString, currDate) };
    }
    if (Object.keys(propUpdates).length > 0) {
        dayEntry = await updateProps(dayEntry.id, propUpdates);
    }
} else {
    if (argv.sleep === '') {
        const bedtimeString = await getUserInput('When did you go to bed? (format: HHMM, 24-hour time)');
        const waketimeString = await getUserInput('when did you wake up?');
        propUpdates = { ...propUpdates, ...makeSleepProps(bedtimeString, waketimeString, currDate) };
    }
    dayEntry = await createEntryForDate(currDate, propUpdates);
}

// print the blocks

if (argv.plan) {
    const plan = await getUserInput("What is your plan for the day?\n")
    updateLifeWikiDayStrategy(plan);
    updateDayStrategy(dayEntry.id, plan);
}

if (argv.syncstrats) {
    const plan = await retrieveLifeWikiDayStrategy();
    updateDayStrategy(dayEntry.id, plan)
}

if (argv.tasks.length > 0) {
    const dayEntryChildBlocks = await getChildBlocks(dayEntry.id);
    const dayEntryTableBlock = dayEntryChildBlocks[3];
    const newTaskBlockChildren = argv.tasks.map(task => {
        // const [taskName, taskTime] = task.split(",");
        return {
            "object": "block",
            "type": "table_row",
            "table_row": {
                "cells": task.split(",").map(taskComponent => [{ "type": "text", "text": { "content": taskComponent } }])
            }
        }
    });
    appendChildBlocks(dayEntryTableBlock.id, newTaskBlockChildren);
}
