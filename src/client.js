import { mountPet } from './pet.js';
import { bindDsh } from './adapter.js';

export const inject = ['uiSession', 'connection'];

export function apply(context) {
  context.effect(() => {
    let binding;
    const pet = mountPet({ onScopeChange: () => binding?.refresh() });
    binding = bindDsh(context, snapshot => pet.updateHost(snapshot), () => pet.settings().scope);
    return () => {
      binding.dispose();
      pet.dispose();
    };
  }, 'gugugaga-pet: companion');
}
