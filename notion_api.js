import { Client } from "@notionhq/client"
import { millisecsPerDay, dateToYYYYMMDD, dateToTitle, getTimezoneFormattedDateStr } from './date_format.js'

const notion = new Client({ auth: process.env.NOTION_KEY });
const calendarDatabaseId = process.env.NOTION_CALENDAR_DATABASE_ID;
const newDayTemplateId = process.env.NOTION_NEWDAY_TEMPLATE_ID
const projectsDatabaseId = process.env.NOTION_PROJECTS_DATABASE_ID
const dayStrategyBlockId = process.env.NOTION_DAYSTRATEGY_BLOCK_ID
const areasDatabaseId = process.env.NOTION_AREAS_DATABASE_ID

async function doesEntryHaveSleep(entryId) {
    const response = await notion.pages.retrieve({
        page_id: entryId
    });
    return response.properties.hasOwnProperty("Time in Bed") && response.properties["Time in Bed"].date !== null && response.properties["Time in Bed"].date.start.length !== 0 && response.properties["Time in Bed"].date.end.length !== 0;
}

async function getEntriesForDate(date) {
    try {
        const response = await notion.databases.query({
            database_id: calendarDatabaseId,
            filter: {
                "property": "Date",
                "date": {
                    "equals": dateToYYYYMMDD(date)
                }
            }
        })
        return response.results
    } catch (error) {
        console.error(error.body);
        return "error";
    }
}

async function getChildBlocks(blockId) {
    const response = await notion.blocks.children.list({
        block_id: blockId,
    })
    return response.results;
}

async function appendChildBlocks(blockId, childBlocks) {
    const response = await notion.blocks.children.append({
        block_id: blockId,
        children: childBlocks,
    })
    return response.results;
}

async function getNewDayTemplateBlocks() {
    
    return await getChildBlocks(newDayTemplateId);
}

async function updateLifeWikiDayStrategy(newText) {
    updateBlockToText(dayStrategyBlockId, newText);
}

async function updateDayStrategy(dayEntryId, newText) {
    const dayBlocks = await getChildBlocks(dayEntryId);
    const strategyBlockId = dayBlocks[1].id;
    updateBlockToText(strategyBlockId, newText)
}

async function updateBlockToText(blockId, newText) {
    const response = await notion.blocks.update({
        block_id: blockId,
        callout: {
            text: [{
                type: "text",
                text: {
                    content: newText
                }
            }]
        }
    })
    console.log(response);
}

async function createEntryForDate(date) {
    try {
        const childBlocks = await getNewDayTemplateBlocks();
        const strippedChildBlocks = await Promise.all(childBlocks.map(async childBlock => {
            const {id, ...restOfBlock} = childBlock;
            if (restOfBlock.type === "table") {
                const childBlocks = await getChildBlocks(id);
                restOfBlock.table.children = childBlocks;
            }
            return restOfBlock;
        }))
        const response = await notion.pages.create({
            parent: { database_id: calendarDatabaseId },
            properties: {
                "title": {
                    "title": [
                        {
                            "text": {
                                "content": dateToTitle(date),
                            },
                        },
                    ],
                },
                "Date": {
                    "date": {
                        "start": dateToYYYYMMDD(date)
                    }
                }
            },
            children: strippedChildBlocks
        })
        console.log(response);
        return response;
    } catch (error) {
        console.error(error.body);
    }
}

async function createProject(name, area, active) {
    const response = await notion.pages.create({
        parent: { database_id: projectsDatabaseId },
        properties: {
            "title": {
                "title": [
                    {
                        "text": {
                            "content": name,
                        },
                    },
                ],
            },
            "Area": {
                "relation": [
                    {
                        "id": await getIdByTitle(area, areasDatabaseId)
                    }
                ]
            },
            "Active": {
                "checkbox": active
            }
        },
    })
    return response;
}

async function getIdByTitle(title, databaseId) {
    const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
            "property": "title",
            "text": {
                "equals": title
            }
        }
    })
    return response.results[0].id
}

async function completeRoutines(tasks, entryId) {
    const propertiesObj = tasks.reduce((obj, task) => ({...obj, [task]: {checkbox: true}}), {});
    const response = await notion.pages.update({
        page_id: entryId,
        properties: propertiesObj
    });
    console.log(response);
}

async function setSleepTime(sleepDate, wakeDate, entryId) {
    
    const dateObj = {
        "start": getTimezoneFormattedDateStr(sleepDate),
        "end": getTimezoneFormattedDateStr(wakeDate),
    };
    const response = await notion.pages.update({
        page_id: entryId,
        properties: {
            "Time in Bed": {
                "date": dateObj
            }
        }
    });
    console.log(response);
}

async function didWeightsOnDayBefore(date) {
    try {
        const response = await notion.databases.query({
            database_id: calendarDatabaseId,
            filter: {
                "and": [
                    {
                        "property": "Date",
                        "date": {
                            "equals": dateToYYYYMMDD(new Date(date.getTime() - millisecsPerDay))
                        }
                    },
                    {
                        "property": "Weights",
                        "checkbox": {
                            "equals": true
                        }
                    }
                ]
            }
        })
        return (response.results.length > 0)
    } catch (error) {
        console.error(error);
        return "error";
    }
}

async function getAreas() {
    const response = await notion.databases.query({
        database_id: areasDatabaseId,
        sorts: [
        {
            property: "Priority",
            direction: "ascending"
        },
        {
            property: "Daily Goal",
            direction: "descending"
        }]
    })
    return response.results;
}

async function getProjects() {
    
    const response = await notion.databases.query({
        database_id: projectsDatabaseId,
    })
    return response.results;
}


export {
    doesEntryHaveSleep,
    getEntriesForDate,
    createEntryForDate,
    didWeightsOnDayBefore,
    completeRoutines,
    setSleepTime,
    updateLifeWikiDayStrategy,
    updateDayStrategy,
    getChildBlocks,
    getAreas,
    getProjects,
    appendChildBlocks,
    createProject
}