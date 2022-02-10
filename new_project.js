import { createProject } from './notion_api.js'
import _yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
const yargs = _yargs(hideBin(process.argv));
const argv = yargs
    .option('name', {
        alias: 'n',
        demandOption: true,
        describe: 'Give a name to the new project',
        type: 'string',
        default: '',
    })
    .option('area', {
        alias: 'a',
        demandOption: true,
        describe: 'Assign an area to the new project',
        type: 'string',
        default: '',
    })
    .option('started', {
        alias: 's',
        demandOption: false,
        describe: 'Mark the project as active',
        type: 'boolean',
        default: false,
    })
    .argv

const response = await createProject(argv.name, argv.area, argv.started);
console.log(response);