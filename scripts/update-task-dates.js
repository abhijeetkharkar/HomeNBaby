/**
 * Update task dates in DynamoDB based on May 22 move date (lease starts May 20)
 * Run: node scripts/update-task-dates.js
 */
process.env.AWS_PROFILE = 'admin';
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs');

const client = new DynamoDBClient({ region: 'us-east-1' });
const TABLE = 'tracker-tasks';

// Helper: remap dates in a subtask or item based on a date map
function remapDate(dateStr, dateMap) {
  return dateMap[dateStr] || dateStr;
}

function remapSubtasks(subtasks, dateMap, subtaskDateMap) {
  return subtasks.map(s => {
    const text = s.M.text?.S || '';
    const newSub = { ...s, M: { ...s.M } };

    // Remap subtask due date — use subtask-specific map if available, else general
    if (s.M.due?.S) {
      const specificMap = subtaskDateMap?.[text];
      if (specificMap) {
        newSub.M = { ...s.M, due: { S: specificMap } };
      } else {
        newSub.M = { ...s.M, due: { S: remapDate(s.M.due.S, dateMap) } };
      }
    }

    // Remap nested items
    if (s.M.items?.L) {
      newSub.M = {
        ...newSub.M,
        items: {
          L: s.M.items.L.map(i => {
            if (i.M.due?.S) {
              return { M: { ...i.M, due: { S: remapDate(i.M.due.S, dateMap) } } };
            }
            return i;
          })
        }
      };
    }
    return newSub;
  });
}

async function updateTask(id, newSubtasks, extraAttrs = {}) {
  const key = { id: { N: String(id) } };
  let updateExpr = 'SET subtasks = :s';
  const exprVals = { ':s': { L: newSubtasks } };

  for (const [attr, val] of Object.entries(extraAttrs)) {
    updateExpr += `, ${attr} = :${attr}`;
    exprVals[`:${attr}`] = val;
  }

  await client.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: key,
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprVals,
  }));
  console.log(`  ✓ Task ${id} updated`);
}

async function main() {
  const items = JSON.parse(fs.readFileSync('tasks-raw.json', 'utf8'));
  const byId = {};
  items.forEach(t => { byId[t.id.N] = t; });

  console.log('\n=== Updating task dates for May 22 move (lease May 20) ===\n');

  // ── TASK 1: Book Moving Company ──────────────────────────────────────────
  {
    const t = byId['1'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-27': '2026-05-17',  // re-confirm 5 days before
      '2026-05-31': '2026-05-21',  // prepare tip
    });
    await updateTask(1, subs);
  }

  // ── TASK 2: Packing Plan ─────────────────────────────────────────────────
  {
    const t = byId['2'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-30': '2026-05-21',  // disassemble furniture
      '2026-05-31': '2026-05-21',  // day 1 bag + IKEA crib item
    });
    await updateTask(2, subs);
  }

  // ── TASK 3: Move Day Execution ───────────────────────────────────────────
  {
    const t = byId['3'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-31': '2026-05-21',  // night before
      '2026-06-01': '2026-05-22',  // move day tasks
    });
    await updateTask(3, subs, { target_month: { S: 'May' } });
  }

  // ── TASK 4: Old Apartment Move-Out ───────────────────────────────────────
  {
    const t = byId['4'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Schedule professional apartment cleaning': '2026-05-16',
      'Patch nail holes and touch-up paint if needed': '2026-05-19',
      'Schedule final walkthrough with landlord': '2026-05-22',
      // Keep June 1 for key return and forwarding address
    });
    await updateTask(4, subs);
  }

  // ── TASK 5: New Lease Setup ──────────────────────────────────────────────
  {
    const t = byId['5'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Collect keys and parking passes': '2026-05-20',
      'Document move-in condition with photos/video': '2026-05-20',
      'Set up renters insurance for new address': '2026-05-20',
    });
    await updateTask(5, subs);
  }

  // ── TASK 6: Utility Overlap Management ───────────────────────────────────
  {
    const t = byId['6'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Electricity/Gas (NEW address): Start service May 31': '2026-05-18',
      'Internet — Spectrum: Schedule self-install kit or tech visit for June 1; return old modem/router': '2026-05-18',
      'Water/Trash/Sewer (NEW): Transfer into name, start June 1': '2026-05-18',
      'Renters Insurance (Lemonade or State Farm): Add new address as primary; keep old until lease ends': '2026-05-18',
      'Rent Autopay: Cancel old autopay, set up new ACH/portal for new landlord': '2026-05-20',
    });
    await updateTask(6, subs);
  }

  // ── TASK 9: Garden Layout & Planting Plan ────────────────────────────────
  {
    const t = byId['9'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-15': '2026-05-03',  // cantaloupe/watermelon sow date
      '2026-06-07': '2026-05-30',  // transplant into mounds
    });
    await updateTask(9, subs);
  }

  // ── TASK 10: Indoor Seed Schedule ────────────────────────────────────────
  {
    const t = byId['10'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-15': '2026-05-03',  // okra — sow today
      '2026-05-20': '2026-05-03',  // cucumbers, gourds, cantaloupe, watermelon
      '2026-06-08': '2026-05-30',  // carrots + mooli direct sow
    });
    await updateTask(10, subs);
  }

  // ── TASK 11: Seedling Care & Hardening Off ───────────────────────────────
  {
    const t = byId['11'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-25': '2026-05-15',  // start hardening off
      '2026-05-27': '2026-05-15',  // days 1-3
      '2026-05-31': '2026-05-19',  // days 4-7
      '2026-06-03': '2026-05-22',  // days 8-10
      '2026-06-07': '2026-05-26',  // days 11-14 / ready to transplant
    });
    await updateTask(11, subs);
  }

  // ── TASK 12: Source Wood & Order Soil ────────────────────────────────────
  {
    const t = byId['12'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Source 1.4 cu yards topsoil — FB Marketplace bulk delivery': '2026-05-23',
      'Source 0.9 cu yards aged compost — local nursery or FB Marketplace': '2026-05-23',
      'Backup: Kellogg Raised Bed Mix at Home Depot (~41 bags)': '2026-05-23',
      'Double-dig native soil under Bed 2 (mooli section) to 12" depth': '2026-05-24',
    });
    await updateTask(12, subs);
  }

  // ── TASK 13: Purchase Garden Supplies & Tools ────────────────────────────
  {
    const t = byId['13'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-10': '2026-05-22',
      '2026-05-15': '2026-05-22',
      '2026-05-20': '2026-05-22',
      '2026-06-01': '2026-05-28',  // mulch
    });
    await updateTask(13, subs);
  }

  // ── TASK 14: Reassemble A-Frame Trellises ────────────────────────────────
  {
    const t = byId['14'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-28': '2026-05-21',  // dismantle at current location
      '2026-06-02': '2026-05-23',  // choose positions
      '2026-06-04': '2026-05-24',  // reassemble
      '2026-06-05': '2026-05-25',  // weed barrier
      '2026-06-07': '2026-05-30',  // transplant at base
    });
    await updateTask(14, subs);
  }

  // ── TASK 15: Build Beds & Transplant ─────────────────────────────────────
  {
    const t = byId['15'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-06-03': '2026-05-23',  // build beds + weed barrier
      '2026-06-04': '2026-05-24',  // base/mid layers
      '2026-06-05': '2026-05-24',  // fill layers / top layer
      '2026-06-06': '2026-05-26',  // drip irrigation
      '2026-06-07': '2026-05-30',  // transplant items
      '2026-06-08': '2026-05-30',  // transplant subtask + Bed 5 + water
    });
    await updateTask(15, subs);
  }

  // ── TASK 16: Summer Garden Maintenance ───────────────────────────────────
  {
    const t = byId['16'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-06-08': '2026-05-31',  // drip timer
      '2026-06-10': '2026-06-01',  // mulch
      '2026-06-14': '2026-06-05',  // plant support/training
      '2026-06-15': '2026-06-07',  // pest management
      '2026-06-20': '2026-06-12',  // Neptune's + okra borer + karela
      '2026-06-28': '2026-06-20',  // mooli succession
    });
    await updateTask(16, subs);
  }

  // ── TASK 21: Set Up Nursery Room ─────────────────────────────────────────
  {
    const t = byId['21'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-06-03': '2026-05-23',  // paint room
      '2026-06-05': '2026-05-26',  // crib, mattress, dresser items
      '2026-06-06': '2026-05-27',  // changing station + stock drawers
      '2026-06-07': '2026-05-28',  // blackout curtains
      '2026-06-08': '2026-05-30',  // monitor, white noise, nightlight
      '2026-06-10': '2026-06-01',  // organise clothes
    });
    await updateTask(21, subs);
  }

  // ── TASK 22: Baby-Safe Home Prep ─────────────────────────────────────────
  {
    const t = byId['22'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-06-07': '2026-05-25',  // dressers & bookshelves
      '2026-06-08': '2026-05-26',  // anchor furniture subtask + TV
      '2026-06-09': '2026-05-27',  // outlet covers
      '2026-06-10': '2026-05-28',  // childproofing subtask + cabinet + corner
      '2026-06-11': '2026-05-29',  // wires
      '2026-06-12': '2026-05-30',  // hazard mgmt subtask + stair gates + cleaning products
    });
    await updateTask(22, subs);
  }

  // ── TASK 30: Packing & Moving Supplies ───────────────────────────────────
  {
    const t = byId['30'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-05-25': '2026-05-15',  // moving blankets — need earlier
    });
    await updateTask(30, subs);
  }

  // ── TASK 31: Garden Materials & Tools (shopping) ─────────────────────────
  {
    const t = byId['31'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Raised bed lumber or kits (×5)': '2026-05-22',
      'Hardware: corner brackets + screws (×40 per bed)': '2026-05-22',
      'Landscape fabric — 3×50 ft roll': '2026-05-22',
      'A-frame #3 for cucumbers': '2026-05-22',
      'Trellis netting — 5 ft × 60 ft roll': '2026-05-22',
      'Bamboo stakes: 6 ft ×10 + 4 ft ×6': '2026-05-22',
      'Drip irrigation: timer + emitter kit': '2026-05-22',
      'Garden hose: 50 ft expandable + Y-splitter': '2026-05-22',
      'Trowel + hand cultivator': '2026-05-22',
      'Leather garden gloves ×2 pairs': '2026-05-22',
      'Foam kneeling pad': '2026-05-22',
      'Long-handle hoe': '2026-05-22',
      "Neptune's Harvest Fish & Seaweed — 1 gallon": '2026-05-22',
      'Mulch: 3 bales of straw': '2026-05-28',
      'Neem oil + dish soap': '2026-05-28',
      'Spinosad (Monterey Garden Insect Spray)': '2026-05-28',
      'Diatomaceous earth — 1 bag': '2026-05-28',
      '1.4 cu yards topsoil (bulk delivery)': '2026-05-23',
      '0.9 cu yards aged compost (bulk delivery)': '2026-05-23',
    });
    await updateTask(31, subs);
  }

  // ── TASK 32: Nursery Room & Large Baby Gear (shopping) ───────────────────
  {
    const t = byId['32'];
    const subs = remapSubtasks(t.subtasks.L, {}, {
      'Crib: IKEA Sundvik or DaVinci Kalani': '2026-05-20',
      'Crib mattress: Newton Baby': '2026-05-20',
      'Changing station: IKEA Hemnes dresser + tray topper': '2026-05-20',
      'Safety strap: Keekaroo Peanut Changer or Summer Infant pad': '2026-05-20',
      'Blackout curtains: NICETOWN or ECLIPSE': '2026-05-22',
      'Baby monitor: Infant Optics DXR-8 Pro or Nanit Pro': '2026-05-22',
      'White noise machine: LectroFan Evo or Hatch Rest+': '2026-05-22',
      'Nightlight: VAVA VA-CL006 amber glow': '2026-05-22',
      'Paint: Sherwin-Williams Drift of Mist or Accessible Beige — 1 gallon': '2026-05-20',
      // Keep car seat May 15, stroller May 20, bouncer/swing June 10
    });
    await updateTask(32, subs);
  }

  // ── TASK 38: Childproofing Supplies (shopping) ───────────────────────────
  {
    const t = byId['38'];
    const subs = remapSubtasks(t.subtasks.L, {
      '2026-06-05': '2026-05-25',
      '2026-06-08': '2026-05-28',
      '2026-06-10': '2026-05-30',
    });
    await updateTask(38, subs);
  }

  console.log('\n✅ All date updates complete.\n');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
