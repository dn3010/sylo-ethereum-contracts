import fs from 'fs/promises';
import path from 'path';

const PKG_DIR =
  process.env.ABI_PACKAGE ??
  path.resolve(__dirname, '../package/@futureverse/sylo-protocol-abi');
const ABI_DIR = path.resolve(__dirname, '../abi');

const syloContracts = [
  'SyloToken',
  'SyloStakingManager',

  'TestSeekers',
  'SeekerStakingManager',
  'SeekerStatsOracle',

  'AuthorizedAccounts',
  'ProtocolTimeManager',
  'Registries',
  'RewardsManager',
  'Ticketing',
];

type ABI = {
  contract: string;
  abi: string;
};

async function parseAbis() {
  const abis = await Promise.all(
    syloContracts.map(async contract => {
      const src = `${ABI_DIR}/${contract}.abi`;
      const abi = await fs.readFile(src).then((b: Buffer) => b.toString());

      await fs.copyFile(src, `${PKG_DIR}/abis/${contract}.abi`);

      return { contract, abi };
    }),
  );

  return abis;
}

async function writePackageIndexTS(abis: ABI[]) {
  let f = ``;

  abis.map(a => {
    f += `export const ${a.contract} = ${a.abi} as const;\n`;
  });

  await fs.writeFile(`${PKG_DIR}/index.ts`, f);
}

async function writePackageIndexJS(abis: ABI[]) {
  let f = ``;

  abis.map(a => {
    f += `const ${a.contract} = ${a.abi};\n`;
  });

  f += '\n';
  f += 'module.exports = {\n';

  abis.map((a, i) => {
    f += `  ${a.contract}: ${a.contract}${i < abis.length - 1 ? ',' : ''}\n`;
  });

  f += '}';

  await fs.writeFile(`${PKG_DIR}/index.js`, f);
}

async function main() {
  const abis = await parseAbis();
  await writePackageIndexTS(abis);
  await writePackageIndexJS(abis);
}

main();
