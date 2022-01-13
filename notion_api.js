import { Client } from "@notionhq/client"
import { millisecsPerDay, dateToYYYYMMDD, dateToTitle, getTimezoneFormattedDateStr } from './date_format.js'

const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

async function doesEntryHaveSleep(entryId) {
    const response = await notion.pages.retrieve({
        page_id: entryId
    });
    return response.properties.hasOwnProperty("Time in Bed") && response.properties["Time in Bed"].date.start.length !== 0 && response.properties["Time in Bed"].date.end.length !== 0;
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


async function createEntryForDate(date) {
    try {
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
            }
        })
        console.log(response);
        return response;
    } catch (error) {
        console.error(error.body);
    }
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

async function completeTasks(tasks, entryId) {
    console.log(tasks);
    const propertiesObj = tasks.reduce((obj, task) => ({...obj, [task]: {checkbox: true}}), {});
    console.log(propertiesObj);
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


export {
    doesEntryHaveSleep,
    getEntriesForDate,
    createEntryForDate,
    didWeightsOnDayBefore,
    completeTasks,
    setSleepTime
}