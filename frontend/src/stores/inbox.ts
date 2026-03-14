import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useInboxStore = defineStore('inbox', () => {
  const unreadReplies = ref(0);

  function setUnread(count: number) {
    unreadReplies.value = count;
  }

  return { unreadReplies, setUnread };
});
