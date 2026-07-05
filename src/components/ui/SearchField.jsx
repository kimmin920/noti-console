import { Search } from 'lucide-react';
import { TextField } from './TextField.jsx';

export function SearchField({ className = '', placeholder = '검색...', ...props }) {
  return (
    <div className={['search-field', className].filter(Boolean).join(' ')}>
      <TextField.Root>
        <TextField.Slot>
          <Search size={16} />
        </TextField.Slot>
        <TextField.Input placeholder={placeholder} {...props} />
      </TextField.Root>
    </div>
  );
}
