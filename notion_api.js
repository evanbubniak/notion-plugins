import { Client } from "@notionhq/client"
import { millisecsPerDay, dateToYYYYMMDD, dateToTitle } from './date_format.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const notion = new Client({ auth: process.env.NOTION_KEY });
const calendarDatabaseId = process.env.NOTION_CALENDAR_DATABASE_ID;
const newDayTemplateId = process.env.NOTION_NEWDAY_TEMPLATE_ID
const projectsDatabaseId = process.env.NOTION_PROJECTS_DATABASE_ID
const dayStrategyBlockId = process.env.NOTION_DAYSTRATEGY_BLOCK_ID
const areasDatabaseId = process.env.NOTION_AREAS_DATABASE_ID
const mainCycleId = process.env.NOTION_MAIN_CYCLE_ID
const cycleTemplateId = process.env.NOTION_CYCLE_TEMPLATE_ID
const notionTasksDatabaseId=process.env.NOTION_TASKS_DATABASE_ID
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

async function getCycleMainBlocks() {

    return await getChildBlocks(mainCycleId);
}

async function getCycleMainFullTodo() {
    try {
        const response = await notion.databases.query({
            database_id: notionTasksDatabaseId,
            filter: {
                "property": "Done",
                "checkbox": {
                    "equals": false
                }
            }
        })
        return response.results
    } catch (error) {
        console.error(error);
        return "error";
    }
}

async function getCycleMainDayTasks() {
    try {
        const response = await notion.databases.query({
            database_id: notionTasksDatabaseId,
            filter: {
                "property": "Cycle",
                "checkbox": {
                    "equals": true
                }
            }
        })
        return response.results
    } catch (error) {
        console.error(error);
        return "error";
    }
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
}

async function getStrippedBlocks(parentId) {
    const childBlocks = await getChildBlocks(parentId);
    const strippedChildBlocks = await Promise.all(childBlocks.map(async childBlock => {
        const { id, ...restOfBlock } = childBlock;

        if (restOfBlock.has_children === true) {
            restOfBlock[restOfBlock.type].children = await getStrippedBlocks(id);
        }
        // if (restOfBlock.has_children === true) {
        //     restOfBlock[restOfBlock.type].children = (await getChildBlocks(id)).filter(childBlock => childBlock.has_children===false)
        // }
        return restOfBlock;
    }))
    return strippedChildBlocks
}

function popChildrenFromToggles(childBlocks) {
    let blocksToAppendLater = [];
    let childBlock;
    for (let ii = 0; ii < childBlocks.length; ii++) {
        childBlock = childBlocks[ii]
        if (childBlock.type === "toggle" && childBlock.has_children === true) {
            blocksToAppendLater.push({
                ii: ii,
                blocks: childBlock[childBlock.type].children
            })
            childBlock.has_children = false;
            delete childBlock[childBlock.type].children
        }
    }
    return blocksToAppendLater
}

// function popBlocksBeyondMaxDepthWithChildren(childBlocks) {
//     let blocksToAppendLater = [];
//     let childBlock;
//     let grandchildBlock;
//     let ii;
//     let jj;
//     for (ii = childBlocks.length-1; ii >= 0; ii--) {
//         childBlock = childBlocks[ii]
//         if (childBlock.has_children === true) {
//             for (jj = childBlock[childBlock.type].children.length - 1; jj >= 0; jj--) {
//                 grandchildBlock = childBlock[childBlock.type].children[jj];
//                 if (grandchildBlock.has_children === true) {
//                     blocksToAppendLater.push({
//                         ii: ii,
//                         jj: jj,
//                         block: childBlock[childBlock.type].children.pop(jj)
//                     })
//                 }

//             }
//         }
//     }
//     return blocksToAppendLater

// }

async function appendBlocksFromOnePageToAnother(srcId, targetId) {
    const strippedSrcBlocks = await getStrippedBlocks(srcId)
    const resp = await appendChildBlocks(targetId, strippedSrcBlocks);
    return resp
}

async function copyDayCycleTemplateToPage(targetId) {
    return appendBlocksFromOnePageToAnother(cycleTemplateId, targetId)
}

async function createEntryForDate(date, props) {
    try {
        const strippedChildBlocks = await getStrippedBlocks(cycleTemplateId)
        console.log(strippedChildBlocks)
        const poppedToggleChildren = popChildrenFromToggles(strippedChildBlocks)
        console.log(poppedToggleChildren)
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
        console.log(response)
        const newPageChildBlocks = await getChildBlocks(response.id)
        const responses = await Promise.all(poppedToggleChildren.map(poppedToggleChild => {
            appendChildBlocks(newPageChildBlocks[poppedToggleChild.ii].id, poppedToggleChild.blocks)
        }))
        console.log(responses)
        return response;
    } catch (error) {
        console.error(error);
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

async function getPropFromBlockId(property, id) {
    const response = await notion.pages.retrieve({
        page_id: id
    });
    const propertyType = response.properties[property].type
    return response.properties[property][propertyType].map(propBlock => propBlock.plain_text).join("")
}

async function updateProps(entryId, props) {
    const response = await notion.pages.update({
        page_id: entryId,
        properties: props
    });
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
    getMostRecentEntries,
    getCycleMainBlocks,
    getCycleMainFullTodo,
    getCycleMainDayTasks,
    getPropFromBlockId,
    appendBlocksFromOnePageToAnother,
    copyDayCycleTemplateToPage
}
