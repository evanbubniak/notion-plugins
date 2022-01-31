import { getChildBlocks, getEntriesForDate, createEntryForDate, doesEntryHaveSleep } from './notion_api.js'
import { addTimezoneOffset } from './date_format.js';
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

const currDate = (argv.date === '') ? new Date() : addTimezoneOffset(new Date(argv.date));
const dayEntries = await getEntriesForDate(currDate);
const dayEntry = (dayEntries.length != 0) ? dayEntries[0] : await createEntryForDate(currDate);
const childBlocks = await getChildBlocks(dayEntry.id);

console.log(dayEntry);

console.log(childBlocks);
// print sleep and wake times

console.log(dayEntry.properties.Day.title[0].text.content)

if (await doesEntryHaveSleep(dayEntry.id)) {
    console.log("Bedtime: " + dayEntry.properties["Time in Bed"].date.start)
    console.log("Wake time: " + dayEntry.properties["Time in Bed"].date.end)    
} else {
    console.log("Sleep time not set or incompletely set");
}

// print list of checkboxes and status

Object.keys(dayEntry.properties).filter(key => dayEntry.properties[key].type === "checkbox").map(key => {
    console.log(key + ': ' + (dayEntry.properties[key].checkbox ? "Done" : "Not Done"));
})

// print day strat

childBlocks.map(childBlock => {
    if (childBlock[childBlock.type].text.length > 0) {
        console.log(childBlock[childBlock.type].text[0].plain_text);
    }
})