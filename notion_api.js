import { Client } from "@notionhq/client"
import { millisecsPerDay, dateToYYYYMMDD, dateToTitle } from './date_format.js'

const notion = new Client({ auth: process.env.NOTION_KEY });
const calendarDatabaseId = process.env.NOTION_CALENDAR_DATABASE_ID;
const newDayTemplateId = process.env.NOTION_NEWDAY_TEMPLATE_ID
const projectsDatabaseId = process.env.NOTION_PROJECTS_DATABASE_ID
const dayStrategyBlockId = process.env.NOTION_DAYSTRATEGY_BLOCK_ID
const areasDatabaseId = process.env.NOTION_AREAS_DATABASE_ID

function doesEntryHaveSleep(dayEntry) {
    return dayEntry.properties.hasOwnProperty("Time in Bed") && dayEntry.properties["Time in Bed"].date !== null && dayEntry.properties["Time in Bed"].date.start.length !== 0 && dayEntry.properties["Time in Bed"].date.end.length !== 0;
}

async function getMostRecentEntries(num_entries) {
    const response = await notion.databases.query({
        database_id: calendarDatabaseId,
        page_size: num_entries,
        sorts: [{
            property: "Date",
            direction: "descending"
        }]
    });
    return response.results;
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

async function retrieveLifeWikiDayStrategy() {
    const response = await notion.blocks.retrieve({
        block_id: dayStrategyBlockId
    });
    return response.callout.text[0].text.content;
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

async function createEntryForDate(date, props) {
    try {
        const childBlocks = await getNewDayTemplateBlocks();
        const strippedChildBlocks = await Promise.all(childBlocks.map(async childBlock => {
            const { id, ...restOfBlock } = childBlock;
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
                },
                ...props
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

async function updateProps(entryId, props) {
    const response = await notion.pages.update({
        page_id: entryId,
        properties: props
    });
    console.log(response);
    return response;
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
    retrieveLifeWikiDayStrategy,
    updateLifeWikiDayStrategy,
    updateDayStrategy,
    getChildBlocks,
    getAreas,
    getProjects,
    appendChildBlocks,
    createProject,
    updateProps,
    getMostRecentEntries
}