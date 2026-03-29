import { useState } from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import ShoppingList from './ShoppingList'
import Items from './Items'

type SubTab = 'list' | 'inventory'

export default function Shopping() {
  const [sub, setSub] = useState<SubTab>('list')

  return (
    <Box>
      <Tabs
        value={sub}
        onChange={(_, v: SubTab) => setSub(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Shopping list" value="list" />
        <Tab label="Inventory" value="inventory" />
      </Tabs>
      {sub === 'list'      && <ShoppingList />}
      {sub === 'inventory' && <Items />}
    </Box>
  )
}
