const yargs = require('yargs/yargs');
const {Bitbucket} = require('bitbucket');
const FormData = require('form-data');

/**
 * Handle arguments that are based on requirements
 */
const argv = yargs(process.argv.slice(2))
	.option('workspace', {
		alias: 'w',
		describe: 'Workspace description',
		demandOption: true,
	})
	.option('slug', {
		alias: 's',
		describe: 'Slug description',
		demandOption: true,
	})
	.option('updatePackage', {
		alias: 'u',
		describe: 'Package to update description',
		demandOption: true,
	})
	.option('versionUpdate', {
		alias: 'v',
		describe: 'Version update description',
		demandOption: true,
	})
	.help()
	.argv;

/**
 * @type {string} workspace - Workspace name
 * @type {string} slug - Slug name repo name
 * @type {string} updatePackage - Package to update
 * @type {string} versionUpdate - Version update
 */
const {workspace, slug, updatePackage, versionUpdate} = argv;

const username = 'aasiuta';
const appPasswords = 'ATBBu6SK456Q5vSYS67yXxD7A47YAEE633D0';

const clientOptions = {
	baseUrl: 'https://api.bitbucket.org/2.0',
	auth: {
		username,
		password: appPasswords,
	},
}

const bitbucket = new Bitbucket(clientOptions)
const branchName = `feature/update-${updatePackage}-${versionUpdate}`;
bitbucket.refs.createBranch({
	workspace,
	repo_slug: slug,
	_body: {
		name: branchName,
		target: {
			hash: 'develop',
		},
	}
}).then((r) => {
	const res = r.data;
	// get parent commit hash
	const parentCommitHash = res.target.parents[0].hash;

	// get package json content
	bitbucket.source.readRoot({
		workspace,
		repo_slug: slug,
		pagelen: 100
	}).then((r) => {
		const files = r.data.values;
		const packageFile = files.find((file) => file.path === 'package.json');

		bitbucket.source.read({
			commit: packageFile.commit.hash,
			workspace,
			repo_slug: slug,
			path: packageFile.path,
		}).then((r) => {
			const deps = JSON.parse(r.data);

			if (deps.dependencies[updatePackage]) {
				deps.dependencies[updatePackage] = `${versionUpdate}`;
			} else {
				console.warn('CANT FIND DEPENDENCY');
			}

			const fD = new FormData();
			fD.append('package.json', JSON.stringify(deps, null, 2));
			bitbucket.source.createFileCommit({
				branch: branchName,
				repo_slug: slug,
				workspace,
				_body: fD,
				files: 'package.json',
				author: 'Andrii Siuta <siuta.andrii@gmail.com>',
				message: `Update ${updatePackage} to ${versionUpdate}`,
			}).then((commitResponse) => {
				bitbucket.pullrequests.create({
					workspace,
					repo_slug: slug,
					_body: {
						destination: {
							branch: {
								name: 'develop'
							}
						},
						source: {
							branch: {
								name: branchName
							}
						},
						title: 'Update package.json',
					}
				}).then((r) => {
					console.log('PR SUCCESS')
				}).catch((e) => {
					console.log('ERROR PR', e);
				})
			}).catch((e) => {
				console.log('ERROR COMMIT');
			})
		})
	})
})

