from rest_framework import viewsets, mixins
from rest_framework.response import Response
from .models import Violation, GlobalSettings
from .serializers import ViolationSerializer, GlobalSettingsSerializer

class ViolationViewSet(viewsets.ModelViewSet):
    queryset = Violation.objects.all()
    serializer_class = ViolationSerializer

class GlobalSettingsViewSet(viewsets.ViewSet):
    def list(self, request):
        settings = GlobalSettings.load()
        serializer = GlobalSettingsSerializer(settings)
        return Response(serializer.data)

    def create(self, request):
        settings = GlobalSettings.load()
        serializer = GlobalSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
