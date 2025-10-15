import { Chipboard, PartGroup } from '../types';

const CHIPBOARDS_KEY = 'placer_chipboards';
const PART_GROUPS_KEY = 'placer_part_groups';

export const storageUtils = {
  // Chipboard library
  getChipboards(): Chipboard[] {
    const data = localStorage.getItem(CHIPBOARDS_KEY);
    return data ? JSON.parse(data) : getDefaultChipboards();
  },

  saveChipboard(chipboard: Chipboard): void {
    const chipboards = this.getChipboards();
    const index = chipboards.findIndex(c => c.id === chipboard.id);
    if (index >= 0) {
      chipboards[index] = chipboard;
    } else {
      chipboards.push(chipboard);
    }
    localStorage.setItem(CHIPBOARDS_KEY, JSON.stringify(chipboards));
  },

  deleteChipboard(id: string): void {
    const chipboards = this.getChipboards().filter(c => c.id !== id);
    localStorage.setItem(CHIPBOARDS_KEY, JSON.stringify(chipboards));
  },

  // Part groups library
  getPartGroups(): PartGroup[] {
    const data = localStorage.getItem(PART_GROUPS_KEY);
    return data ? JSON.parse(data) : [];
  },

  savePartGroup(group: PartGroup): void {
    const groups = this.getPartGroups();
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) {
      groups[index] = group;
    } else {
      groups.push(group);
    }
    localStorage.setItem(PART_GROUPS_KEY, JSON.stringify(groups));
  },

  deletePartGroup(id: string): void {
    const groups = this.getPartGroups().filter(g => g.id !== id);
    localStorage.setItem(PART_GROUPS_KEY, JSON.stringify(groups));
  },
};

function getDefaultChipboards(): Chipboard[] {
  return [
    {
      id: '1',
      name: 'Standard Sheet 2440x1220mm',
      dimensions: { width: 2440, height: 1220 },
      thickness: 18,
      margin: 0,
    },
    {
      id: '2',
      name: 'Standard Sheet 2800x2070mm',
      dimensions: { width: 2800, height: 2070 },
      thickness: 18,
      margin: 0,
    },
    {
      id: '3',
      name: 'Small Sheet 1220x610mm',
      dimensions: { width: 1220, height: 610 },
      thickness: 18,
      margin: 0,
    },
  ];
}

