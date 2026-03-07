<script setup lang="ts">
import { ref } from 'vue';

const fields = [
  { name: 'name', label: 'Nimi / Nick', type: 'text', placeholder: 'Käyttäjänimi', required: true },
  { name: 'email', label: 'Sähköposti', type: 'email', placeholder: 'sahkoposti@example.com', required: false },
  { name: 'location', label: 'Paikkakunta', type: 'text', placeholder: 'Kaupunki', required: false },
  { name: 'favDrink', label: 'Lempijuoma', type: 'text', placeholder: 'Mitä juot?', required: false },
  { name: 'motivation', label: 'Miksi haluat liittyä?', type: 'textarea', placeholder: '...', required: true },
] as const;

type FieldName = typeof fields[number]['name'];

const form = ref<Record<FieldName, string>>({ name: '', email: '', motivation: '', favDrink: '', location: '' });
const sent = ref(false);

function submit() {
  // TODO: lähetä hakemuksen backend-reitti
  sent.value = true;
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-purple-300 mb-2">Hakemus</h1>
    <p class="text-gray-400 mb-8">Täytä hakemus liittyäksesi Kanniaalio+:aan.</p>

    <div v-if="sent" class="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
      <p class="text-green-300 font-semibold text-lg">Hakemus lähetetty! 🎉</p>
      <p class="text-gray-400 text-sm mt-1">Kännimestarit ottavat yhteyttä.</p>
    </div>

    <form v-else @submit.prevent="submit" class="space-y-5">
      <div v-for="field in fields" :key="field.name">
        <label class="block text-sm text-gray-400 mb-1">{{ field.label }}</label>
        <component
          :is="field.type === 'textarea' ? 'textarea' : 'input'"
          v-model="form[field.name as keyof typeof form]"
          :type="field.type !== 'textarea' ? field.type : undefined"
          :placeholder="field.placeholder"
          :required="field.required"
          :rows="field.type === 'textarea' ? 4 : undefined"
          class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>
      <button type="submit"
        class="w-full py-2.5 bg-purple-700 hover:bg-purple-600 rounded-lg font-semibold text-white transition-colors">
        Lähetä hakemus
      </button>
    </form>
  </div>
</template>
