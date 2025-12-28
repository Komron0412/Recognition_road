from django.db import models

class Violation(models.Model):
    VIOLATION_TYPES = [
        ('Person', 'Person'),
        ('Car', 'Car'),
        ('Bike', 'Bike'),
        ('Bus', 'Bus'),
        ('Truck', 'Truck'),
        ('Motorcycle', 'Motorcycle'),
        ('Unknown', 'Unknown'),
    ]

    violator_name = models.CharField(max_length=100, default="Unknown")
    violation_type = models.CharField(max_length=50, choices=VIOLATION_TYPES, default='Person')
    timestamp = models.DateTimeField(auto_now_add=True)
    video_file = models.CharField(max_length=255) # Storing relative path
    is_reviewed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.violator_name} ({self.violation_type}) - {self.timestamp}"

    class Meta:
        ordering = ['-timestamp']

class GlobalSettings(models.Model):
    # Singleton pattern enforcement (we only want one settings row)
    road_zone_x_percent = models.FloatField(default=0.6) # 0.0 to 1.0 (e.g. 0.6 = 60%)
    roi_x = models.IntegerField(default=0)
    roi_y = models.IntegerField(default=0)
    roi_w = models.IntegerField(default=100)
    roi_h = models.IntegerField(default=100)

    def save(self, *args, **kwargs):
        self.pk = 1 # Force singleton
        super(GlobalSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Global Settings"

# Signal to delete file on DB deletion
from django.db.models.signals import post_delete
from django.dispatch import receiver
import os
from django.conf import settings

@receiver(post_delete, sender=Violation)
def delete_video_file(sender, instance, **kwargs):
    if instance.video_file:
        file_path = os.path.join(settings.MEDIA_ROOT, instance.video_file)
        if os.path.isfile(file_path):
            os.remove(file_path)
            print(f"Deleted file: {file_path}")
