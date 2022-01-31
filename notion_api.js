import { Client } from "@notionhq/client"
import { millisecsPerDay, dateToYYYYMMDD, dateToTitle, getTimezoneFormattedDateStr } from './date_format.js'

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

async function doesEntryHaveSleep(entryId) {
    const response = await notion.pages.retrieve({
        page_id: entryId
    });
    return response.properties.hasOwnProperty("Time in Bed") && response.properties["Time in Bed"].date !== null && response.properties["Time in Bed"].date.start.length !== 0 && response.properties["Time in Bed"].date.end.length !== 0;
}

async function getEntriesForDate(date) {
    try {
        const response = await notion.databases.query({
            database_id: databaseId,
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

async function getNewDayTemplateBlocks() {
    const templateId = "c890999bcc5548be9c4de4bb2ddbc804";
    return await getChildBlocks(templateId);
}

async function updateLifeWikiDayStrategy(newText) {
    const dayStrategyBlockId = "1299712f047c483c97bd28047b59efce";
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
        const strippedChildBlocks = childBlocks.map(childBlock => {
            const {id, ...restOfBlock} = childBlock;
            return restOfBlock;
        })
        const response = await notion.pages.create({
            parent: { database_id: databaseId },
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

async function completeTasks(tasks, entryId) {
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
            database_id: databaseId,
            filter: {
                "and": [
                    {
                        "property": "Date",
                        "date": {
                            "equals": dateToYYYYMMDD(new Date(date.getTime() - millsecsPerDay))
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


export {
    doesEntryHaveSleep,
    getEntriesForDate,
    createEntryForDate,
    didWeightsOnDayBefore,
    completeTasks,
    setSleepTime,
    updateLifeWikiDayStrategy,
    updateDayStrategy,
    getChildBlocks
}