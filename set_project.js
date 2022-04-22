
import { updateProps, getProjects } from './notion_api.js'
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
const yargs = _yargs(hideBin(process.argv));

const argv = yargs
    .option('name', {
        alias: 'n',
        demandOption: true,
        describe: 'Name of project to set',
        type: 'string',
        default: '',
    })
    .option('active', {
        alias: "a",
        demandOption: false,
        describe: "Set active status of project to (true, false)",
        type: "boolean",
        default: null
    })
    .option('completed', {
        alias: 'c',
        demandOption: false,
        describe: "Set completed status of project to (true, false)",
        type: "boolean",
        default: null
    })
    .argv


const projects = await getProjects();
const projectsWithName = projects.filter(projectPage => projectPage.properties.Name.title[0].text.content == argv.name);
let projectPage;
if (projectsWithName.length > 0) {
    projectPage = projectsWithName[0];
    let propUpdates = {};
    if (argv.active != null) {
        propUpdates = { ...propUpdates, ...{"Active": argv.active} };
    }
    if (argv.completed != null) {
        propUpdates = { ...propUpdates, ...{"Completed": argv.completed} };
    }
    if (Object.keys(propUpdates).length > 0) {
        projectPage = await updateProps(projectPage.id, propUpdates);
    }
}
