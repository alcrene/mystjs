import chalk from 'chalk';
import check from 'check-node-version';
import type { ISession } from '../session/types';
import version from '../version';
import { docLinks } from '../docs';

const INSTALL_NODE_MESSAGE = `
You can download Node here:

${chalk.bold('https://nodejs.org/en/download/')}

Upgrade your Node Package Manager (npm) using:

${chalk.bold('npm install -g npm@latest')}

Additional Documentation:

${chalk.bold.blue(docLinks.installNode)}
`;

type VersionResults = Parameters<Parameters<typeof check>[1]>[1];

export async function getNodeVersion(session: ISession): Promise<VersionResults | null> {
  const result = new Promise<VersionResults | null>((resolve) => {
    check({ node: '>= 14.0.0', npm: '>=7' }, (error, results) => {
      if (error) {
        session.log.error(error);
        resolve(null);
        return;
      }
      resolve(results);
    });
  });
  return result;
}

export function logVersions(session: ISession, result: VersionResults | null, debug = true) {
  const versions: string[][] = [];
  Object.entries(result?.versions ?? {}).forEach(([name, p]) => {
    versions.push([
      name,
      p.version ? `${p.version}` : 'Package Not Found',
      `Required: ${p.wanted?.raw || ''}`,
      p.isSatisfied ? '✅' : '⚠️',
    ]);
  });
  versions.push(['myst', version]);
  const versionString = versions
    .map(
      ([n, v, r, c]) =>
        `\n - ${n.padEnd(25, ' ')}${v.padStart(10, ' ').padEnd(15, ' ')}${r?.padEnd(25) ?? ''}${
          c ?? ''
        }`,
    )
    .join('');
  session.log[debug ? 'debug' : 'info'](`\n\nMyst CLI Versions:${versionString}\n\n`);
}

export async function checkNodeVersion(session: ISession): Promise<boolean> {
  const result = await getNodeVersion(session);
  if (!result) return false;
  if (result.isSatisfied) return true;
  logVersions(session, result, false);
  session.log.error('Please update your Node or NPM versions.\n');
  session.log.info(INSTALL_NODE_MESSAGE);
  return false;
}
