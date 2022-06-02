import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import { basename, resolve } from 'path';
import { CURVENOTE_YML, writeSiteConfig, writeProjectConfig } from '../config';
import { ProjectConfig } from '../config/types';
import { docLinks, LOGO } from '../docs';
import { LogLevel } from '../logging';
import { MyUser } from '../models';
import { ISession } from '../session/types';
import { selectors } from '../store';
import { writeFileToFolder } from '../utils';
import { startServer } from '../web';
import { interactiveCloneQuestions } from './clone';
import { pullProjects } from './pull';
import questions from './questions';
import { getDefaultProjectConfig, getDefaultSiteConfig, INIT_LOGO_PATH } from './utils';

type Options = {
  branch?: string;
  force?: boolean;
  yes?: boolean;
  domain?: string;
};

const WELCOME = async (session: ISession) => `

${chalk.bold.green('Welcome to the Curvenote CLI!!')} 👋

${chalk.bold('curvenote init')} walks you through creating a ${chalk.bold(CURVENOTE_YML)} file.

You can use this client library to:

 - ${chalk.bold('sync content')} to & from Curvenote
 - ${chalk.bold('build & export')} professional PDFs
 - create a ${chalk.bold('local website')} & deploy to ${chalk.blue(
  `https://${
    session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
  }.curve.space`,
)}

Find out more here:
${docLinks.overview}

`;

const FINISHED = async (session: ISession) => `

${chalk.bold(chalk.green('Curvenote setup is complete!!'))} 🚀

You can use this client library to:

  - ${chalk.bold('curvenote pull')}: Update your content to what is on https://curvenote.com
  - ${chalk.bold('curvenote start')}: Start a local web server now!
  - ${chalk.bold('curvenote deploy')}: Share content on ${chalk.blue(
  `https://${
    session.isAnon ? 'your' : (await new MyUser(session).get()).data.username
  }.curve.space`,
)}

Find out more here:
${docLinks.overview}

`;

/**
 * Initialize local curvenote project from folder or remote project
 *
 * It creates a new curvenote.yml file in the current directory with
 * both site and project configuration.
 *
 * This fails if curvenote.yml already exists; use `start` or `add`.
 */
export async function init(session: ISession, opts: Options) {
  if (!opts.yes) session.log.info(await WELCOME(session));
  if (opts.domain) session.log.info(`Using custom domain ${opts.domain}`);
  let path = '.';
  // Initialize config - error if it exists
  if (
    selectors.selectLocalSiteConfig(session.store.getState()) ||
    selectors.selectLocalProjectConfig(session.store.getState(), '.')
  ) {
    throw Error(
      `The ${CURVENOTE_YML} config already exists, did you mean to ${chalk.bold(
        'curvenote add',
      )} or ${chalk.bold('curvenote start')}?`,
    );
  }
  const folderName = basename(resolve(path));
  const siteConfig = getDefaultSiteConfig(folderName);

  // Load the user now, and wait for it below!
  let me: MyUser | Promise<MyUser> | undefined;
  if (!session.isAnon) me = new MyUser(session).get();

  const folderIsEmpty = fs.readdirSync(path).length === 0;
  if (folderIsEmpty && opts.yes) throw Error('Cannot initialize an empty folder');
  let content;
  if (!folderIsEmpty && opts.yes) content = 'folder';
  else {
    const response = await inquirer.prompt([questions.content({ folderIsEmpty })]);
    content = response.content;
  }

  let projectConfig: ProjectConfig;
  let pullComplete = false;
  if (content === 'folder') {
    let title = folderName;
    if (!opts.yes) {
      const promptTitle = await inquirer.prompt([
        questions.title({ title: siteConfig.title || '' }),
      ]);
      title = promptTitle.title;
    }
    projectConfig = getDefaultProjectConfig(title);
    siteConfig.projects = [{ path, slug: basename(resolve(path)) }];
    pullComplete = true;
  } else if (content === 'curvenote') {
    const results = await interactiveCloneQuestions(session);
    const { siteProject } = results;
    projectConfig = results.projectConfig;
    path = siteProject.path;
    siteConfig.nav = [{ title: projectConfig.title, url: `/${siteProject.slug}` }];
    siteConfig.projects = [siteProject];
    session.log.info(`Add other projects using: ${chalk.bold('curvenote clone')}\n`);
  } else {
    throw Error(`Invalid init content: ${content}`);
  }
  // Personalize the config
  me = await me;
  siteConfig.title = projectConfig.title;
  siteConfig.logoText = projectConfig.title;
  if (me) {
    const { username, twitter } = me.data;
    siteConfig.domains = opts.domain
      ? [opts.domain.replace(/^http[s]*:\/\//, '')]
      : [`${username}.curve.space`];
    if (twitter) siteConfig.twitter = twitter;
  }
  // Save the configs to the state and write them to disk
  writeSiteConfig(session, '.', siteConfig);
  writeProjectConfig(session, path, projectConfig);

  const pullOpts = { level: LogLevel.debug };
  let pullProcess: Promise<void> | undefined;
  if (!pullComplete) {
    pullProcess = pullProjects(session, pullOpts).then(() => {
      pullComplete = true;
    });
  }

  if (siteConfig.logo === INIT_LOGO_PATH) {
    writeFileToFolder(INIT_LOGO_PATH, LOGO);
  }

  if (!opts.yes) session.log.info(await FINISHED(session));

  let start = false;
  if (!opts.yes) {
    const promptStart = await inquirer.prompt([questions.start()]);
    start = promptStart.start;
  }
  if (!start && !opts.yes) {
    session.log.info(chalk.dim('\nYou can do this later with:'), chalk.bold('curvenote start'));
  }
  if (!pullComplete) {
    pullOpts.level = LogLevel.info;
    session.log.info(
      `${chalk.dim('\nFinishing')} ${chalk.bold('curvenote pull')}${chalk.dim(
        '. This may take a minute ⏳...',
      )}`,
    );
  }
  if (start) {
    await pullProcess;
    session.log.info(chalk.dim('\nStarting local server with: '), chalk.bold('curvenote start'));
    await startServer(session, opts);
  }
  await pullProcess;
}
