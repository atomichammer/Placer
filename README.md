# Placer - 2D Rectangle Cutting Optimizer

A modern web application for optimizing the placement of 2D rectangular parts on chipboards/sheets. Designed for furniture makers, carpenters, and anyone who needs to optimize material cutting.

## Features

- **Project Management**: Create and manage cutting projects with customizable saw thickness
- **Chipboard Library**: Store and reuse common chipboard sizes
- **Part Management**: Add parts with dimensions, quantities, and rotation settings
- **Smart Placement Algorithm**: Guillotine-based bin packing algorithm optimized for straight cuts
- **Visual Results**: Interactive canvas visualization showing how parts are placed
- **Detailed Statistics**: 
  - Total parts count
  - Number of chipboards used
  - Total cut length
  - Cut operations count
  - Material efficiency percentage
- **Auto-scaling**: Automatically adds more chipboards if parts don't fit on one sheet

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

## How to Use

1. **Create a Project**
   - Enter a project name
   - Set saw thickness (default: 3mm)
   - Select a chipboard from the library or create a new one

2. **Add Parts**
   - Click "Add Part" button
   - Enter part dimensions (width × height)
   - Set quantity
   - Choose if rotation is allowed

3. **Run Placement**
   - Click "Run Placement" to calculate optimal layout
   - View results on interactive canvas
   - Click parts to see details
   - Review statistics

4. **Interpret Results**
   - Each part is shown in a different color
   - Rotated parts are marked with ↻ symbol
   - Click on parts to see detailed information
   - Switch between multiple chipboards if needed

## Technology Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **HTML Canvas** - Visualization

## Algorithm

The application uses a **Guillotine bin packing algorithm** which:
- Prioritizes straight cuts (vertical and horizontal)
- Places largest parts first
- Automatically handles rotation when allowed
- Minimizes waste and cut operations

## Data Storage

- Chipboard library stored in browser's localStorage
- Part groups can be saved for reuse
- Projects are session-based (not persisted)

## Future Enhancements

- Export cutting diagrams to PDF
- Part grouping functionality
- Import/export projects
- Advanced optimization options
- Cut sequence optimization
- Material cost calculation

