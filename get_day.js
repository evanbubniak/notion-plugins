import { doesEntryHaveSleep, getChildBlocks, didWeightsOnDayBefore, getEntriesForDate, createEntryForDate, getAreas, getProjects } from './notion_api.js'
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
const didWeightsOnDayBeforeDate = await didWeightsOnDayBefore(currDate);
const dayEntries = await getEntriesForDate(currDate);
const dayEntry = (dayEntries.length != 0) ? dayEntries[0] : await createEntryForDate(currDate, {});
const dayEntryChildBlocks = await getChildBlocks(dayEntry.id);
const areas = await getAreas();
const projects = await getProjects();
const dayEntryTableChildren = await getChildBlocks(dayEntryChildBlocks[3].id);

function getName(page) { return page.properties.Name.title[0].text.content }

console.log(dayEntry.properties.Day.title[0].text.content)

if (doesEntryHaveSleep(dayEntry)) {
    console.log("Bedtime: " + new Date(Date.parse(dayEntry.properties["Time in Bed"].date.start)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    console.log("Wake time: " + new Date(Date.parse(dayEntry.properties["Time in Bed"].date.end)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
} else {
    console.log("Sleep time not set or incompletely set");
}

// print day strat
dayEntryChildBlocks.slice(0, 2).map(childBlock => {
    if (childBlock[childBlock.type].text.length > 0) {
        console.log(childBlock[childBlock.type].text[0].plain_text);
    }
})

Object.keys(dayEntry.properties).filter(key => dayEntry.properties[key].type === "checkbox" && !dayEntry.properties[key].checkbox).map(key => {
    if (key !== "Weights" || !didWeightsOnDayBeforeDate) {
        console.log(key + ": Not Done");
    }
})


const projectNameNotWorkedOnOnDay = (projectName) => !dayEntryTableChildren.some((child) => child.table_row.cells[0][0].text.content == projectName);
const activeUnfinishedProjects = projects.filter(project => project.properties.Active.checkbox && !project.properties.Completed.checkbox);

areas.filter(area => area.properties["Daily Goal"].number > 0).filter(area => area.properties.Projects.relation.length !== 0).map(area => {
    const areaActiveUnfinishedProjectNames = activeUnfinishedProjects.filter(project => project.properties.Area.relation.some(projectArea => projectArea.id === area.id)).map(getName).filter(projectNameNotWorkedOnOnDay);
    if (areaActiveUnfinishedProjectNames.length > 0) {
        const areaProjectsString = ": " + areaActiveUnfinishedProjectNames.join(", ");
        console.log(area.properties.Name.title[0].text.content + " (" + area.properties["Daily Goal"].number.toString() + ")" + areaProjectsString);
    }
})