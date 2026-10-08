import * as filesystem from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/** Stage all generated files before replacing tracked artifacts; restore old files on publish failure. */
export async function publishBuildArtifacts(artifacts, fs = filesystem) {
  const stages = [];
  const published = [];
  let primaryError = null;
  const retainedBackups = new Set();
  try {
    for (const { path, content } of artifacts) {
      // A sibling temporary directory keeps rename() on the same filesystem as the target.
      const directory = await fs.mkdtemp(join(dirname(path), `.${basename(path)}-build-`));
      const stage = {
        path,
        directory,
        next: join(directory, 'next'),
        previous: join(directory, 'previous'),
        existed: false,
      };
      stages.push(stage);
      await fs.writeFile(stage.next, content, 'utf8');
      try {
        await fs.copyFile(path, stage.previous);
        stage.existed = true;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    for (const stage of stages) {
      await fs.rename(stage.next, stage.path);
      published.push(stage);
    }
  } catch (error) {
    primaryError = error;
    const rollbackErrors = [];
    for (const stage of published.reverse()) {
      try {
        if (stage.existed) await fs.rename(stage.previous, stage.path);
        else await fs.rm(stage.path, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
        retainedBackups.add(stage.directory);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], `Не удалось восстановить артефакты; резервные копии сохранены в: ${[...retainedBackups].join(', ')}`);
    }
    throw error;
  } finally {
    for (const stage of stages) {
      if (retainedBackups.has(stage.directory)) continue;
      try {
        await fs.rm(stage.directory, { recursive: true, force: true });
      } catch (cleanupError) {
        if (!primaryError) throw cleanupError;
      }
    }
  }
}
