// create previous day if it wasn't created yet, from the template
// copy the current cycle data in
// then reset the tickboxes and time schedule

// take a day as input, create it if it does not exist, and then transfer the cycle data to it and reset the cycle


import { copyDayCycleTemplateToPage, getPropFromBlockId, getCycleMainDayTasks, getCycleMainFullTodo, getCycleMainBlocks, retrieveLifeWikiDayStrategy, doesEntryHaveSleep, updateProps, appendChildBlocks, updateDayStrategy, getEntriesForDate, createEntryForDate, updateLifeWikiDayStrategy, getChildBlocks } from './notion_api.js'
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

const currDate = (argv.date === '') ? new Date() : addTimezoneOffset(new Date(argv.date));
let propUpdates = {};
const dayEntries = await getEntriesForDate(currDate);
let dayEntry;
if (dayEntries.length !== 0) {
    dayEntry = dayEntries[0];
} else {
    dayEntry = await createEntryForDate(currDate, propUpdates);
}

// copyDayCycleTemplateToPage(dayEntry.id)
const properties = (await getCycleMainFullTodo()).map(result => result.properties)
const priorities = properties.map(prop => prop.Priority.select)
const priorityLevels = priorities.map(priority => priority === null ? "" : priority.name)
const timeEstimateMinutes = properties.map(prop => prop.Minutes.number === null ? "" : prop.Minutes.number.toString())
const areaNameIds = properties.map(prop => prop.Areas.relation[0].id)
const areaNames = await Promise.all(areaNameIds.map(areaNameId => getPropFromBlockId("Name", areaNameId)))
const projectNameIds = properties.map(prop => prop.Projects.relation.length > 0 ? prop.Projects.relation[0].id : "")
const projectNames = await Promise.all(projectNameIds.map(projectNameId => projectNameId !== "" ? getPropFromBlockId("Name", projectNameId) : ""))
const itemNames = properties.map(prop => prop.Item.title[0].plain_text)
const cycleChecked = properties.map(prop => prop.Cycle.checkbox)
const doneChecked = properties.map(prop => prop.Done.checkbox)


// print the blocks
function toCell(val) {
    return [{
        type: "text",
        text: {
            content: val,
            link: null
        },
        href: null
    }]
}
// schema 1 (done unchecked): cycle, item, done, priority, minutes, areas, projects
let todoTableRows = [];
for (let ii = 0; ii < properties.length; ii++) {
    if (doneChecked[ii] === false) {
        todoTableRows.push({
            object: "block",
            archived: false,
            has_children: false,
            table_row: {
                cells: [cycleChecked[ii]=== true ? "✅" : "", itemNames[ii], doneChecked[ii]=== true ? "✅" : "", priorityLevels[ii], timeEstimateMinutes[ii], areaNames[ii], projectNames[ii]].map(toCell)
            },
            type: "table_row"
        })
    }

}
// schema 2 (cycle checked): check, priority, minutes, item
let cycleTableRows = [];
for (let ii = 0; ii < properties.length; ii++) {
    if (cycleChecked[ii] === true) {
        cycleTableRows.push({
            object: "block",
            archived: false,
            has_children: false,
            table_row: {
                cells: [doneChecked[ii]=== true ? "✅" : "", priorityLevels[ii], timeEstimateMinutes[ii], itemNames[ii]].map(toCell)
            },
            type: "table_row"
        })
    }
}

const dayEntryChildBlocks = await getChildBlocks(dayEntry.id);
const dayEntryTableBlock1 = (await getChildBlocks(dayEntryChildBlocks[0].id))[0]
const dayEntryTableBlock2 = dayEntryChildBlocks[1]
appendChildBlocks(dayEntryTableBlock1.id, todoTableRows)
appendChildBlocks(dayEntryTableBlock2.id, cycleTableRows)