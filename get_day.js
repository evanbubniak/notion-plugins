import { getMostRecentEntries, doesEntryHaveSleep, getChildBlocks, didWeightsOnDayBefore, getEntriesForDate, createEntryForDate, getAreas, getProjects } from './notion_api.js'
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
    .option('list-days', {
        alias: 'l',
        demandOption: false,
        describe: "Print out a summary of the most recent days on record",
        type: 'boolean',
        default: false
    })
    .option('list-projects', {
        demandOption: false,
        describe: "Print out a summary of all projects",
        type: 'boolean',
        default: false
    })
    .argv

function getDayName(dayPage) { return dayPage.properties.Day.title[0].text.content};
function getProjectName(projectPage) { return projectPage.properties.Name.title[0].text.content }
function formatTime(time) {
    return new Date(Date.parse(time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

if (argv['list-days']) {
    const NUM_ENTRIES_TO_RETRIEVE = 5;
    const mostRecentEntries = await getMostRecentEntries(NUM_ENTRIES_TO_RETRIEVE);
    mostRecentEntries.forEach(entry => {
        const finishedRoutines = Object.keys(entry.properties).filter(key => entry.properties[key].type === "checkbox" && entry.properties[key].checkbox).join(" ");
        const entryStr = `${getDayName(entry)}: ${formatTime(entry.properties["Time in Bed"].date.start)} -> ${formatTime(entry.properties["Time in Bed"].date.end)} ${finishedRoutines}`;
        console.log(entryStr);
    })
} else if (argv['list-projects']) {
    const projects = await getProjects();
    const areas = await getAreas();
    projects.forEach(project => {
        const projectArea = areas.filter(area => area.id == project.properties.Area.relation[0].id)[0];
        const projectStr = `${getProjectName(projectArea)}: ${getProjectName(project)}`;
        console.log(projectStr);
    })
}
else {
    const currDate = (argv.date === '') ? new Date() : addTimezoneOffset(new Date(argv.date));
    const didWeightsOnDayBeforeDate = await didWeightsOnDayBefore(currDate);
    const dayEntries = await getEntriesForDate(currDate);
    const dayEntry = (dayEntries.length != 0) ? dayEntries[0] : await createEntryForDate(currDate, {});
    const dayEntryChildBlocks = await getChildBlocks(dayEntry.id);
    const areas = await getAreas();
    const projects = await getProjects();
    const dayEntryTableChildren = await getChildBlocks(dayEntryChildBlocks[3].id);

    console.log(getDayName(dayEntry))

    if (doesEntryHaveSleep(dayEntry)) {
        console.log("Bedtime: " + formatTime(dayEntry.properties["Time in Bed"].date.start));
        console.log("Wake time: " + formatTime(dayEntry.properties["Time in Bed"].date.end));
    } else {
        console.log("Sleep time not set or incompletely set");
    }

    // print day strat
    dayEntryChildBlocks.slice(0, 2).forEach(childBlock => {
        if (childBlock[childBlock.type].text.length > 0) {
            console.log(childBlock[childBlock.type].text[0].plain_text);
        }
    })

    Object.keys(dayEntry.properties).filter(key => dayEntry.properties[key].type === "checkbox" && !dayEntry.properties[key].checkbox).forEach(key => {
        if (key !== "Weights" || !didWeightsOnDayBeforeDate) {
            console.log(key + ": Not Done");
        }
    })


    const projectNameNotWorkedOnOnDay = (projectName) => !dayEntryTableChildren.some((child) => child.table_row.cells[0][0].text.content == projectName);
    const activeUnfinishedProjects = projects.filter(project => project.properties.Active.checkbox && !project.properties.Completed.checkbox);

    areas.filter(area => area.properties["Daily Goal"].number > 0).filter(area => area.properties.Projects.relation.length !== 0).forEach(area => {
        const areaActiveUnfinishedProjectNames = activeUnfinishedProjects.filter(project => project.properties.Area.relation.some(projectArea => projectArea.id === area.id)).map(getProjectName).filter(projectNameNotWorkedOnOnDay);
        if (areaActiveUnfinishedProjectNames.length > 0) {
            const areaProjectsString = ": " + areaActiveUnfinishedProjectNames.join(", ");
            console.log(area.properties.Name.title[0].text.content + " (" + area.properties["Daily Goal"].number.toString() + ")" + areaProjectsString);
        }
    })
}